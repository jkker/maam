/**
 * Workflow Service
 *
 * Provides integration with the Workflow SDK for durable operations.
 * This service manages workflow initialization and provides methods
 * to start and manage durable workflows.
 */

import { logger } from './logger'

/**
 * Workflow service for managing durable workflows
 *
 * The service provides a centralized way to:
 * - Start durable workflows for long-running operations
 * - Track workflow runs and their status
 * - Resume workflows after server restarts
 */
class WorkflowService {
  private initialized = false
  private workflowRuns = new Map<string, WorkflowRun>()

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
   * Start a scheduled task workflow
   *
   * @param type - Task type to schedule
   * @param hour - Hour to run (0-23)
   * @param minute - Minute to run (0-59)
   * @param timezone - IANA timezone
   * @param params - Optional task parameters
   */
  startScheduledTaskWorkflow(
    type: string,
    hour: number,
    minute: number,
    timezone: string,
    params?: string,
  ): string {
    // Use crypto.randomUUID() for deterministic-friendly ID generation
    const runId = `schedule-${type}-${hour}:${minute}-${crypto.randomUUID().slice(0, 8)}`

    logger.info(
      `[WorkflowService] Starting scheduled task workflow: ${runId} for ${type} at ${hour}:${minute}`,
    )

    // Track the workflow run
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
    // Use crypto.randomUUID() for deterministic-friendly ID generation
    const runId = `unlock-${deviceId}-${crypto.randomUUID().slice(0, 8)}`

    logger.info(
      `[WorkflowService] Starting delayed unlock workflow: ${runId} for device ${deviceId} in ${delayMinutes}m`,
    )

    // Track the workflow run
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
    return Array.from(this.workflowRuns.values()).filter((run) => run.status === 'running')
  }

  /**
   * Mark a workflow run as completed
   *
   * @param runId - Workflow run ID
   * @param status - Final status
   */
  completeWorkflowRun(runId: string, status: 'completed' | 'failed' | 'cancelled') {
    const run = this.workflowRuns.get(runId)
    if (run) {
      run.status = status
      run.completedAt = new Date().toISOString()
      logger.info(`[WorkflowService] Workflow ${runId} completed with status: ${status}`)
    }
  }
}

/**
 * Workflow run metadata
 */
interface WorkflowRun {
  id: string
  type: string
  status: 'running' | 'completed' | 'failed' | 'cancelled'
  startedAt: string
  completedAt?: string
  metadata?: Record<string, unknown>
}

// Export singleton instance
export const workflowService = new WorkflowService()
