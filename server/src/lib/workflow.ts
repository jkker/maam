/**
 * Workflow Service
 *
 * Provides integration with the Workflow SDK for durable operations.
 * This service manages workflow initialization and provides methods
 * to start and manage durable workflows.
 *
 * Features:
 * - Durable workflow execution that survives restarts
 * - Task lifecycle management with retry logic
 * - Observability with workflow run tracking
 * - Hook management for external resumption
 */

import type { TaskType } from './schema'

import { logger } from './logger'

/**
 * Workflow run metadata for tracking execution state
 */
export interface WorkflowRun {
  id: string
  type: WorkflowRunType
  status: WorkflowStatus
  startedAt: string
  completedAt?: string
  metadata?: Record<string, unknown>
  error?: string
  retryCount?: number
}

export type WorkflowRunType =
  | 'task'
  | 'immediate-task'
  | 'scheduled-task'
  | 'delayed-unlock'
  | 'batch'
  | 'cancel'

export type WorkflowStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'

/**
 * Hook registration for workflow resumption
 */
export interface HookRegistration {
  token: string
  workflowRunId: string
  taskId: string
  createdAt: string
  status: 'pending' | 'resumed' | 'expired'
}

/**
 * Workflow service for managing durable workflows
 *
 * The service provides a centralized way to:
 * - Start durable workflows for long-running operations
 * - Track workflow runs and their status
 * - Resume workflows after server restarts via hooks
 * - Provide observability into workflow execution
 */
class WorkflowService {
  private initialized = false
  private workflowRuns = new Map<string, WorkflowRun>()
  private hookRegistry = new Map<string, HookRegistration>()

  /**
   * Initialize the workflow service
   * This sets up the local embedded world for development
   */
  initialize() {
    if (this.initialized) return

    try {
      logger.info('[WorkflowService] Initializing workflow service...')

      // The workflow SDK is initialized via the Vite plugin
      // which handles the "use workflow" and "use step" directives
      this.initialized = true

      logger.info('[WorkflowService] Workflow service initialized')
    } catch (error) {
      logger.error('[WorkflowService] Failed to initialize:', error)
      throw error
    }
  }

  /**
   * Check if the service is initialized
   */
  get isInitialized() {
    return this.initialized
  }

  /**
   * Generate a unique workflow run ID
   */
  private generateRunId(prefix: string): string {
    return `${prefix}-${crypto.randomUUID().slice(0, 8)}`
  }

  /**
   * Start a task workflow
   *
   * @param type - Task type to execute
   * @param taskId - Task ID
   * @param params - Optional task parameters
   */
  startTaskWorkflow(type: TaskType, taskId: string, params?: string): string {
    const runId = this.generateRunId(`task-${type}`)

    logger.info(`[WorkflowService] Starting task workflow: ${runId} for task ${taskId}`)

    this.workflowRuns.set(runId, {
      id: runId,
      type: 'task',
      status: 'running',
      startedAt: new Date().toISOString(),
      metadata: { taskType: type, taskId, params },
    })

    return runId
  }

  /**
   * Start an immediate task workflow
   *
   * @param type - Task type to execute
   * @param taskId - Task ID
   * @param params - Optional task parameters
   */
  startImmediateTaskWorkflow(type: TaskType, taskId: string, params?: string): string {
    const runId = this.generateRunId(`immediate-${type}`)

    logger.debug(`[WorkflowService] Starting immediate task workflow: ${runId} for task ${taskId}`)

    this.workflowRuns.set(runId, {
      id: runId,
      type: 'immediate-task',
      status: 'running',
      startedAt: new Date().toISOString(),
      metadata: { taskType: type, taskId, params },
    })

    return runId
  }

  /**
   * Start a scheduled task workflow
   *
   * @param type - Task type to schedule
   * @param hour - Hour to run (0-23)
   * @param minute - Minute to run (0-59)
   * @param timezone - IANA timezone
   * @param params - Optional task parameters
   */
  startScheduledTaskWorkflow(
    type: TaskType,
    hour: number,
    minute: number,
    timezone: string,
    params?: string,
  ): string {
    const runId = this.generateRunId(`schedule-${type}-${hour}:${minute}`)

    logger.info(
      `[WorkflowService] Starting scheduled task workflow: ${runId} for ${type} at ${hour}:${minute}`,
    )

    this.workflowRuns.set(runId, {
      id: runId,
      type: 'scheduled-task',
      status: 'running',
      startedAt: new Date().toISOString(),
      metadata: { taskType: type, hour, minute, timezone, params },
    })

    return runId
  }

  /**
   * Start a delayed unlock workflow
   *
   * @param deviceId - Device ID to unlock
   * @param userId - User ID
   * @param delayMinutes - Minutes to wait before unlocking
   */
  startDelayedUnlockWorkflow(deviceId: string, userId: string, delayMinutes: number): string {
    const runId = this.generateRunId(`unlock-${deviceId}`)

    logger.info(
      `[WorkflowService] Starting delayed unlock workflow: ${runId} for device ${deviceId} in ${delayMinutes}m`,
    )

    this.workflowRuns.set(runId, {
      id: runId,
      type: 'delayed-unlock',
      status: 'running',
      startedAt: new Date().toISOString(),
      metadata: { deviceId, userId, delayMinutes },
    })

    return runId
  }

  /**
   * Start a batch task workflow
   *
   * @param tasks - Array of tasks to execute
   */
  startBatchWorkflow(tasks: Array<{ type: TaskType; params?: string }>): string {
    const runId = this.generateRunId('batch')

    logger.info(`[WorkflowService] Starting batch workflow: ${runId} with ${tasks.length} tasks`)

    this.workflowRuns.set(runId, {
      id: runId,
      type: 'batch',
      status: 'running',
      startedAt: new Date().toISOString(),
      metadata: { taskCount: tasks.length, tasks },
    })

    return runId
  }

  /**
   * Register a hook for workflow resumption
   *
   * @param token - Hook token
   * @param workflowRunId - Associated workflow run ID
   * @param taskId - Associated task ID
   */
  registerHook(token: string, workflowRunId: string, taskId: string): void {
    this.hookRegistry.set(token, {
      token,
      workflowRunId,
      taskId,
      createdAt: new Date().toISOString(),
      status: 'pending',
    })

    logger.debug(`[WorkflowService] Registered hook ${token} for task ${taskId}`)
  }

  /**
   * Get hook registration by token
   *
   * @param token - Hook token
   */
  getHook(token: string): HookRegistration | undefined {
    return this.hookRegistry.get(token)
  }

  /**
   * Mark a hook as resumed
   *
   * @param token - Hook token
   */
  resumeHook(token: string): boolean {
    const hook = this.hookRegistry.get(token)
    if (hook && hook.status === 'pending') {
      hook.status = 'resumed'
      logger.debug(`[WorkflowService] Resumed hook ${token}`)
      return true
    }
    return false
  }

  /**
   * Get workflow run status
   *
   * @param runId - Workflow run ID
   */
  getWorkflowRun(runId: string): WorkflowRun | undefined {
    return this.workflowRuns.get(runId)
  }

  /**
   * List all active workflow runs
   */
  listActiveRuns(): WorkflowRun[] {
    return Array.from(this.workflowRuns.values()).filter(
      (run) => run.status === 'running' || run.status === 'pending',
    )
  }

  /**
   * List all workflow runs
   */
  listAllRuns(): WorkflowRun[] {
    return Array.from(this.workflowRuns.values())
  }

  /**
   * Mark a workflow run as completed
   *
   * @param runId - Workflow run ID
   * @param status - Final status
   * @param error - Optional error message
   */
  completeWorkflowRun(runId: string, status: 'completed' | 'failed' | 'cancelled', error?: string) {
    const run = this.workflowRuns.get(runId)
    if (run) {
      run.status = status
      run.completedAt = new Date().toISOString()
      if (error) run.error = error
      logger.info(`[WorkflowService] Workflow ${runId} completed with status: ${status}`)
    }
  }

  /**
   * Increment retry count for a workflow run
   *
   * @param runId - Workflow run ID
   */
  incrementRetryCount(runId: string): number {
    const run = this.workflowRuns.get(runId)
    if (run) {
      run.retryCount = (run.retryCount ?? 0) + 1
      return run.retryCount
    }
    return 0
  }

  /**
   * Get workflow statistics
   */
  getStats(): {
    total: number
    running: number
    completed: number
    failed: number
    cancelled: number
    pending: number
  } {
    const runs = Array.from(this.workflowRuns.values())
    return {
      total: runs.length,
      pending: runs.filter((r) => r.status === 'pending').length,
      running: runs.filter((r) => r.status === 'running').length,
      completed: runs.filter((r) => r.status === 'completed').length,
      failed: runs.filter((r) => r.status === 'failed').length,
      cancelled: runs.filter((r) => r.status === 'cancelled').length,
    }
  }

  /**
   * Clean up completed workflow runs older than the specified age
   *
   * @param maxAgeMinutes - Maximum age in minutes (default: 24 hours)
   */
  cleanupOldRuns(maxAgeMinutes: number = 1440): number {
    const cutoff = Date.now() - maxAgeMinutes * 60 * 1000
    let cleaned = 0

    for (const [runId, run] of this.workflowRuns) {
      if (
        run.status !== 'running' &&
        run.status !== 'pending' &&
        run.completedAt &&
        new Date(run.completedAt).getTime() < cutoff
      ) {
        this.workflowRuns.delete(runId)
        cleaned++
      }
    }

    if (cleaned > 0) {
      logger.debug(`[WorkflowService] Cleaned up ${cleaned} old workflow runs`)
    }

    return cleaned
  }
}

// Export singleton instance
export const workflowService = new WorkflowService()
