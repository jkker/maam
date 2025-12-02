/**
 * Task Workflow - Durable task execution using Workflow SDK
 *
 * This workflow handles the lifecycle of a task:
 * 1. Create task in queue (PENDING)
 * 2. Wait for MAA client to poll and start (RUNNING)
 * 3. Wait for completion (DONE)
 *
 * Uses the Workflow SDK's durability features to survive restarts
 * and maintain task state across failures.
 *
 * Features:
 * - Retry logic with exponential backoff
 * - Observability with step metadata and logging
 * - Hooks for external resumption (MAA client reports status)
 */

import type { TaskType, TaskStage } from '../lib/schema'

import {
  sleep,
  createHook,
  FatalError,
  RetryableError,
  getStepMetadata,
  getWorkflowMetadata,
  getWritable,
} from 'workflow'

import { logger } from '../lib/logger'

/**
 * Task state that can be serialized across workflow replays
 */
export interface TaskState {
  id: string
  type: TaskType
  params?: string
  stage: TaskStage
  status?: 'SUCCESS' | 'FAILED' | 'CANCELLED'
  payload?: string
  createdAt: string
  startedAt?: string
  completedAt?: string
  duration?: number
  // Workflow tracking
  workflowRunId?: string
  hookToken?: string
  attempt?: number
}

/**
 * Hook payload for task status reports
 */
export interface TaskStatusPayload {
  status: 'SUCCESS' | 'FAILED' | 'CANCELLED'
  payload?: string
}

/**
 * Task execution result
 */
export interface TaskResult {
  state: TaskState
  success: boolean
  error?: string
}

// Step function retry configuration
const DEFAULT_MAX_RETRIES = 3
const IMMEDIATE_TASK_TIMEOUT_SECONDS = 30
const QUEUED_TASK_TIMEOUT_MINUTES = 60

/**
 * Main task workflow - orchestrates task lifecycle with full durability
 *
 * @param type - The type of task to execute
 * @param createdAt - ISO timestamp when task was created
 * @param params - Optional task parameters
 * @param timeoutMinutes - Maximum time to wait for task completion
 */
export async function taskWorkflow(
  type: TaskType,
  createdAt: string,
  params?: string,
  timeoutMinutes: number = QUEUED_TASK_TIMEOUT_MINUTES,
): Promise<TaskResult> {
  'use workflow'

  const workflowMeta = getWorkflowMetadata()
  const id = `${type}|${createdAt}`

  const state: TaskState = {
    id,
    type,
    params,
    stage: 'PENDING',
    createdAt,
    workflowRunId: workflowMeta.workflowRunId,
  }

  // Log workflow start
  await logWorkflowEvent(id, 'STARTED', { type, params, workflowRunId: state.workflowRunId })

  try {
    // Create a hook to receive status updates from MAA client
    const statusHook = createHook<TaskStatusPayload>({
      token: `task:${id}`, // Deterministic token based on task ID
    })
    state.hookToken = statusHook.token

    // Register task in the pending queue with retry logic
    await registerTaskWithRetry(state, statusHook.token)
    state.stage = 'PENDING'

    // Race between task completion and timeout
    const result = await Promise.race([
      waitForTaskCompletion(statusHook, state),
      sleep(`${timeoutMinutes}m`).then(async (): Promise<TaskState> => {
        const cancelledAt = await getTimestamp()
        return {
          ...state,
          stage: 'DONE',
          status: 'CANCELLED',
          completedAt: cancelledAt,
        }
      }),
    ])

    // Log completion
    await logWorkflowEvent(id, 'COMPLETED', {
      status: result.status,
      duration: result.duration,
    })

    return {
      state: result,
      success: result.status === 'SUCCESS',
    }
  } catch (error) {
    // Log error
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    await logWorkflowEvent(id, 'FAILED', { error: errorMessage })

    // Mark task as failed
    state.stage = 'DONE'
    state.status = 'FAILED'
    state.completedAt = new Date().toISOString()

    return {
      state,
      success: false,
      error: errorMessage,
    }
  }
}

/**
 * Register task in the pending queue with retry logic
 */
// eslint-disable-next-line @typescript-eslint/require-await
async function registerTaskWithRetry(state: TaskState, hookToken: string) {
  'use step'

  const metadata = getStepMetadata()

  logger.info(
    `[Workflow] Registering task ${state.id} (attempt ${metadata.attempt}/${DEFAULT_MAX_RETRIES})`,
  )

  try {
    // The actual task registration happens here
    // In a real implementation, this would communicate with the MaaManager
    state.hookToken = hookToken

    return {
      registered: true,
      hookToken,
      stepId: metadata.stepId,
      attempt: metadata.attempt,
    }
  } catch (error) {
    // Implement exponential backoff for retries
    const backoffMs = Math.pow(2, metadata.attempt) * 1000

    if (metadata.attempt < DEFAULT_MAX_RETRIES) {
      throw new RetryableError(`Failed to register task ${state.id}, retrying...`, {
        retryAfter: backoffMs,
      })
    }

    throw new FatalError(`Failed to register task ${state.id} after ${metadata.attempt} attempts`)
  }
}
registerTaskWithRetry.maxRetries = DEFAULT_MAX_RETRIES

/**
 * Wait for task completion via hook with observability
 */
async function waitForTaskCompletion(
  hook: ReturnType<typeof createHook<TaskStatusPayload>>,
  state: TaskState,
): Promise<TaskState> {
  'use workflow'

  // Mark task as waiting for MAA client to start
  await logWorkflowEvent(state.id, 'WAITING', { hookToken: state.hookToken })

  // Wait for the MAA client to report status
  // This will suspend the workflow until the hook is resumed
  const { status, payload } = await hook

  // Get completion timestamp from a step function for determinism
  const completedAt = await getTimestamp()

  // Update state with completion info
  state.status = status
  state.payload = payload
  state.stage = 'DONE'
  state.completedAt = completedAt

  if (state.startedAt) {
    state.duration = new Date(completedAt).getTime() - new Date(state.startedAt).getTime()
  }

  return state
}

/**
 * Get current timestamp in a step function for determinism
 */
// eslint-disable-next-line @typescript-eslint/require-await
async function getTimestamp(): Promise<string> {
  'use step'
  return new Date().toISOString()
}

/**
 * Immediate task workflow - for tasks that need synchronous completion
 *
 * HeartBeat, StopTask, and CaptureImageNow are immediate tasks
 * that must complete before the API response is sent.
 */
export async function immediateTaskWorkflow(
  type: TaskType,
  createdAt: string,
  params?: string,
  timeoutSeconds: number = IMMEDIATE_TASK_TIMEOUT_SECONDS,
): Promise<TaskResult> {
  'use workflow'

  const workflowMeta = getWorkflowMetadata()
  const id = `${type}|${createdAt}`

  const state: TaskState = {
    id,
    type,
    params,
    stage: 'PENDING',
    createdAt,
    workflowRunId: workflowMeta.workflowRunId,
  }

  await logWorkflowEvent(id, 'IMMEDIATE_STARTED', { type, params })

  try {
    // Create a hook with deterministic token
    const statusHook = createHook<TaskStatusPayload>({
      token: `immediate:${id}`,
    })
    state.hookToken = statusHook.token

    // Register as immediate task
    await registerImmediateTaskWithRetry(state, statusHook.token)

    // Race with shorter timeout for immediate tasks
    const result = await Promise.race([
      waitForTaskCompletion(statusHook, state),
      sleep(`${timeoutSeconds}s`).then(async (): Promise<TaskState> => {
        const cancelledAt = await getTimestamp()
        return {
          ...state,
          stage: 'DONE',
          status: 'CANCELLED',
          completedAt: cancelledAt,
        }
      }),
    ])

    await logWorkflowEvent(id, 'IMMEDIATE_COMPLETED', { status: result.status })

    return {
      state: result,
      success: result.status === 'SUCCESS',
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    await logWorkflowEvent(id, 'IMMEDIATE_FAILED', { error: errorMessage })

    state.stage = 'DONE'
    state.status = 'FAILED'
    state.completedAt = new Date().toISOString()

    return {
      state,
      success: false,
      error: errorMessage,
    }
  }
}

/**
 * Register immediate task with retry logic
 */
// eslint-disable-next-line @typescript-eslint/require-await
async function registerImmediateTaskWithRetry(state: TaskState, hookToken: string) {
  'use step'

  const metadata = getStepMetadata()

  logger.debug(
    `[Workflow] Registering immediate task ${state.id} (attempt ${metadata.attempt}/${DEFAULT_MAX_RETRIES})`,
  )

  try {
    state.hookToken = hookToken

    return {
      registered: true,
      hookToken,
      immediate: true,
      stepId: metadata.stepId,
      attempt: metadata.attempt,
    }
  } catch (error) {
    const backoffMs = Math.pow(2, metadata.attempt) * 500 // Faster backoff for immediate tasks

    if (metadata.attempt < DEFAULT_MAX_RETRIES) {
      throw new RetryableError(`Failed to register immediate task ${state.id}, retrying...`, {
        retryAfter: backoffMs,
      })
    }

    throw new FatalError(
      `Failed to register immediate task ${state.id} after ${metadata.attempt} attempts`,
    )
  }
}
registerImmediateTaskWithRetry.maxRetries = DEFAULT_MAX_RETRIES

/**
 * Log workflow events for observability
 * Uses workflow streams for structured logging
 */
async function logWorkflowEvent(taskId: string, event: string, data: Record<string, unknown> = {}) {
  'use step'

  const metadata = getStepMetadata()

  const logEntry = {
    timestamp: metadata.stepStartedAt.toISOString(),
    taskId,
    event,
    stepId: metadata.stepId,
    attempt: metadata.attempt,
    ...data,
  }

  // Log to console with structured format
  logger.debug(`[Workflow:${event}] Task ${taskId}`, data)

  // Write to workflow stream for observability
  try {
    const logStream = getWritable({ namespace: 'task-logs' })
    const writer = logStream.getWriter()
    await writer.write(logEntry)
    writer.releaseLock()
  } catch {
    // Stream may not be available in all contexts
  }

  return logEntry
}

/**
 * Schedule workflow - handles scheduled task dispatch with durability
 *
 * This workflow sleeps until the scheduled time, then dispatches the task.
 * Uses durability to survive restarts and ensure tasks are dispatched.
 */
export async function scheduleWorkflow(
  type: TaskType,
  hour: number,
  minute: number,
  timezone: string,
  params?: string,
): Promise<TaskResult> {
  'use workflow'

  const workflowMeta = getWorkflowMetadata()
  const scheduleId = `schedule:${type}|${hour}:${minute}`

  await logWorkflowEvent(scheduleId, 'SCHEDULE_STARTED', {
    type,
    hour,
    minute,
    timezone,
    workflowRunId: workflowMeta.workflowRunId,
  })

  // Calculate time until next scheduled run using a step function for determinism
  const msUntilScheduled = await calculateTimeUntilScheduled(hour, minute, timezone)

  // Sleep until scheduled time (this is durable and survives restarts)
  await sleep(msUntilScheduled)

  // Get timestamp for task creation from step function
  const createdAt = await getTimestamp()

  // Dispatch the task
  const taskResult = await taskWorkflow(type, createdAt, params)

  // Log the result
  await logWorkflowEvent(scheduleId, 'SCHEDULE_COMPLETED', {
    taskId: taskResult.state.id,
    status: taskResult.state.status,
  })

  return taskResult
}

/**
 * Calculate milliseconds until scheduled time (deterministic step)
 */
// eslint-disable-next-line @typescript-eslint/require-await
async function calculateTimeUntilScheduled(
  hour: number,
  minute: number,
  _timezone: string,
): Promise<number> {
  'use step'

  const now = new Date()
  const scheduledTime = new Date()
  scheduledTime.setHours(hour, minute, 0, 0)

  // If scheduled time has passed today, schedule for tomorrow
  if (scheduledTime <= now) {
    scheduledTime.setDate(scheduledTime.getDate() + 1)
  }

  return scheduledTime.getTime() - now.getTime()
}

/**
 * Lock workflow - handles manager lock with delayed unlock
 *
 * When the manager is locked, this workflow can schedule an automatic unlock
 * after a specified delay. This is durable and survives restarts.
 */
export async function delayedUnlockWorkflow(
  deviceId: string,
  userId: string,
  delayMinutes: number,
): Promise<{ unlocked: boolean; deviceId: string; userId: string }> {
  'use workflow'

  const workflowMeta = getWorkflowMetadata()
  const unlockId = `unlock:${deviceId}`

  await logWorkflowEvent(unlockId, 'UNLOCK_SCHEDULED', {
    deviceId,
    userId,
    delayMinutes,
    workflowRunId: workflowMeta.workflowRunId,
  })

  // Sleep for the specified delay (durable)
  await sleep(`${delayMinutes}m`)

  // Perform the unlock with retry logic
  const result = await performUnlockWithRetry(deviceId, userId)

  await logWorkflowEvent(unlockId, 'UNLOCK_COMPLETED', { success: result.success })

  return { unlocked: result.success, deviceId, userId }
}

/**
 * Perform the actual unlock operation with retry logic
 */
// eslint-disable-next-line @typescript-eslint/require-await
async function performUnlockWithRetry(
  deviceId: string,
  _userId: string,
): Promise<{ success: boolean }> {
  'use step'

  const metadata = getStepMetadata()

  logger.info(
    `[Workflow] Performing delayed unlock for device ${deviceId} (attempt ${metadata.attempt})`,
  )

  try {
    // This will be implemented to call the manager service
    // In production, this would communicate with the MaaManager
    return { success: true }
  } catch (error) {
    const backoffMs = Math.pow(2, metadata.attempt) * 1000

    if (metadata.attempt < DEFAULT_MAX_RETRIES) {
      throw new RetryableError(`Failed to unlock device ${deviceId}, retrying...`, {
        retryAfter: backoffMs,
      })
    }

    throw new FatalError(`Failed to unlock device ${deviceId} after ${metadata.attempt} attempts`)
  }
}
performUnlockWithRetry.maxRetries = DEFAULT_MAX_RETRIES

/**
 * Cancel task workflow - for stopping running tasks
 */
export async function cancelTaskWorkflow(
  taskId: string,
  reason: string = 'User requested cancellation',
): Promise<TaskResult> {
  'use workflow'

  const workflowMeta = getWorkflowMetadata()

  await logWorkflowEvent(taskId, 'CANCEL_REQUESTED', {
    reason,
    workflowRunId: workflowMeta.workflowRunId,
  })

  // Send cancellation to the task's hook
  const cancelled = await sendCancellation(taskId, reason)

  // Get timestamps from step function for determinism
  const timestamp = await getTimestamp()
  const state: TaskState = {
    id: taskId,
    type: 'StopTask' as TaskType,
    stage: 'DONE',
    status: 'CANCELLED',
    createdAt: timestamp,
    completedAt: timestamp,
    workflowRunId: workflowMeta.workflowRunId,
  }

  return {
    state,
    success: cancelled,
    error: cancelled ? undefined : 'Failed to cancel task',
  }
}

/**
 * Send cancellation to a task's hook
 */
// eslint-disable-next-line @typescript-eslint/require-await
async function sendCancellation(taskId: string, _reason: string): Promise<boolean> {
  'use step'

  const metadata = getStepMetadata()

  logger.info(`[Workflow] Cancelling task ${taskId} (stepId: ${metadata.stepId})`)

  // In production, this would resume the task's hook with CANCELLED status
  // using resumeHook from 'workflow/api'
  return true
}

/**
 * Batch task workflow - for executing multiple tasks in sequence
 */
export async function batchTaskWorkflow(
  tasks: Array<{ type: TaskType; params?: string }>,
): Promise<TaskResult[]> {
  'use workflow'

  const workflowMeta = getWorkflowMetadata()
  const batchId = `batch:${workflowMeta.workflowRunId}`
  const results: TaskResult[] = []

  await logWorkflowEvent(batchId, 'BATCH_STARTED', {
    taskCount: tasks.length,
    workflowRunId: workflowMeta.workflowRunId,
  })

  for (const task of tasks) {
    const createdAt = await getTimestamp()
    const result = await taskWorkflow(task.type, createdAt, task.params)
    results.push(result)

    // Stop batch if a task fails (unless it's expected to continue)
    if (!result.success && task.type !== 'HeartBeat') {
      await logWorkflowEvent(batchId, 'BATCH_STOPPED', {
        reason: 'Task failed',
        failedTaskId: result.state.id,
      })
      break
    }
  }

  await logWorkflowEvent(batchId, 'BATCH_COMPLETED', {
    completedCount: results.length,
    successCount: results.filter((r) => r.success).length,
  })

  return results
}
