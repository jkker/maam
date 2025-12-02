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
 */

import type { TaskType, TaskStage } from '../lib/schema'

import { sleep, createHook, FatalError } from 'workflow'

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
}

/**
 * Hook payload for task status reports
 */
export interface TaskStatusPayload {
  status: 'SUCCESS' | 'FAILED' | 'CANCELLED'
  payload?: string
}

/**
 * Main task workflow - orchestrates task lifecycle
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
  timeoutMinutes: number = 60,
) {
  'use workflow'

  const id = `${type}|${createdAt}`
  const state: TaskState = {
    id,
    type,
    params,
    stage: 'PENDING',
    createdAt,
  }

  // Create a hook to receive status updates from MAA client
  const statusHook = createHook<TaskStatusPayload>()

  // Register task in the pending queue (step)
  await registerTask(state, statusHook.token)

  // Race between task completion and timeout
  const result = await Promise.race([
    waitForCompletion(statusHook, state),
    sleep(`${timeoutMinutes}m`).then(() => {
      throw new FatalError(`Task ${id} timed out after ${timeoutMinutes} minutes`)
    }),
  ])

  return result
}

/**
 * Register task in the pending queue
 * This is a step function with full Node.js access
 */
// eslint-disable-next-line @typescript-eslint/require-await
async function registerTask(state: TaskState, hookToken: string) {
  'use step'

  // This will be called by the MaaManager to register the task
  // The actual implementation will emit events to the manager
  console.log(`[Workflow] Registering task ${state.id} with hook token ${hookToken}`)

  return { registered: true, hookToken }
}

/**
 * Wait for task completion via hook
 */
async function waitForCompletion(
  hook: ReturnType<typeof createHook<TaskStatusPayload>>,
  state: TaskState,
): Promise<TaskState> {
  'use workflow'

  // Wait for the MAA client to report status
  const { status, payload } = await hook

  // Update state
  state.status = status
  state.payload = payload
  state.stage = 'DONE'
  state.completedAt = new Date().toISOString()

  if (state.startedAt) {
    state.duration = new Date(state.completedAt).getTime() - new Date(state.startedAt).getTime()
  }

  return state
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
  timeoutSeconds: number = 30,
) {
  'use workflow'

  const id = `${type}|${createdAt}`
  const state: TaskState = {
    id,
    type,
    params,
    stage: 'PENDING',
    createdAt,
  }

  // Create a hook to receive status updates
  const statusHook = createHook<TaskStatusPayload>()

  // Register as immediate task
  await registerImmediateTask(state, statusHook.token)

  // Race with shorter timeout for immediate tasks
  const result = await Promise.race([
    waitForCompletion(statusHook, state),
    sleep(`${timeoutSeconds}s`).then(() => {
      throw new FatalError(`Immediate task ${id} timed out after ${timeoutSeconds} seconds`)
    }),
  ])

  return result
}

/**
 * Register immediate task for synchronous execution
 */
// eslint-disable-next-line @typescript-eslint/require-await
async function registerImmediateTask(state: TaskState, hookToken: string) {
  'use step'

  console.log(`[Workflow] Registering immediate task ${state.id} with hook token ${hookToken}`)

  return { registered: true, hookToken, immediate: true }
}

/**
 * Schedule workflow - handles scheduled task dispatch
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
) {
  'use workflow'

  // Calculate time until next scheduled run
  const now = new Date()
  const scheduledTime = new Date()
  scheduledTime.setHours(hour, minute, 0, 0)

  // If scheduled time has passed today, schedule for tomorrow
  if (scheduledTime <= now) {
    scheduledTime.setDate(scheduledTime.getDate() + 1)
  }

  const msUntilScheduled = scheduledTime.getTime() - now.getTime()

  // Sleep until scheduled time
  await sleep(msUntilScheduled)

  // Dispatch the task
  const createdAt = new Date().toISOString()
  const taskResult = await taskWorkflow(type, createdAt, params)

  // Log the result
  await logScheduledTaskCompletion(type, taskResult)

  return taskResult
}

/**
 * Log scheduled task completion
 */
// eslint-disable-next-line @typescript-eslint/require-await
async function logScheduledTaskCompletion(type: TaskType, state: TaskState) {
  'use step'

  console.log(`[Workflow] Scheduled task ${type} completed with status: ${state.status}`)

  return { logged: true }
}

/**
 * Lock workflow - handles manager lock with delayed unlock
 *
 * When the manager is locked, this workflow can schedule an automatic unlock
 * after a specified delay.
 */
export async function delayedUnlockWorkflow(
  deviceId: string,
  userId: string,
  delayMinutes: number,
) {
  'use workflow'

  // Sleep for the specified delay
  await sleep(`${delayMinutes}m`)

  // Perform the unlock
  await performUnlock(deviceId, userId)

  return { unlocked: true, deviceId, userId }
}

/**
 * Perform the actual unlock operation
 */
// eslint-disable-next-line @typescript-eslint/require-await
async function performUnlock(deviceId: string, userId: string) {
  'use step'

  console.log(`[Workflow] Performing delayed unlock for device ${deviceId}, user ${userId}`)

  // This will be implemented to call the manager service
  return { success: true }
}
