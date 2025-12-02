/**
 * Workflow-based Task class
 *
 * This class wraps the Workflow SDK's durable execution model
 * while maintaining the same external API as the original Task class.
 *
 * Key differences from the original:
 * - Uses hooks instead of EventEmitter for status updates
 * - Task state is persisted via workflow durability
 * - Survives server restarts and failures
 */

import type { TaskStage, TaskType, ImmediateTask } from './lib/schema'

import { IMMEDIATE_TASK } from './const'
import { DEBUG, logger } from './lib/logger'
import { getNow } from './lib/temporal'

/**
 * Hook token for external systems to resume workflows
 */
export interface TaskHook {
  token: string
  resume: (payload: TaskStatusPayload) => Promise<void>
}

export interface TaskStatusPayload {
  status: 'SUCCESS' | 'FAILED' | 'CANCELLED'
  payload?: string
}

/**
 * Runtime representation of a task in the workflow system
 *
 * This class maintains backward compatibility with the original Task class
 * while internally using workflow hooks for coordination.
 */
export class WorkflowTask {
  public payload?: string
  public status?: 'SUCCESS' | 'FAILED' | 'CANCELLED'
  public stage: TaskStage = 'PENDING'
  public startedAt?: Temporal.ZonedDateTime
  public completedAt?: Temporal.ZonedDateTime
  public logs?: string

  // Workflow hook token for resuming the workflow
  public hookToken?: string

  // Promise resolvers for waitFor compatibility
  private stageResolvers = new Map<
    TaskStage,
    { resolve: (task: WorkflowTask) => void; reject: (error: Error) => void }[]
  >()

  /**
   * Creates a new workflow-based task
   *
   * @param type - Task type from MAA schema
   * @param createdAt - Creation timestamp
   * @param params - Optional task parameters
   * @param id - Unique task identifier (auto-generated if not provided)
   */
  constructor(
    public type: TaskType,
    public createdAt: Temporal.ZonedDateTime,
    public params: string | undefined = undefined,
    public id = `${type}|${createdAt.toString()}`,
  ) {}

  static RunError = class TaskRunError extends Error {
    name = 'TaskRunError'
  }
  static TimeoutError = class TimeoutError extends Error {
    name = 'TimeoutError'
  }

  /**
   * Check if a task type is immediate (synchronous execution)
   */
  static isImmediate = (type: TaskType): type is ImmediateTask =>
    IMMEDIATE_TASK.includes(type as ImmediateTask)

  /**
   * Whether this task requires immediate execution
   */
  get immediate() {
    return WorkflowTask.isImmediate(this.type)
  }

  /**
   * Get screenshot image buffer if task type is CaptureImage
   */
  get image() {
    if (this.type === 'CaptureImage' || this.type === 'CaptureImageNow') {
      if (!this.payload) throw new Error('No payload available')
      return Buffer.from(this.payload, 'base64')
    }
  }

  /**
   * Calculate task duration in milliseconds
   */
  get duration() {
    if (!this.startedAt) return undefined
    const end = this.completedAt ?? getNow()
    return end.since(this.startedAt).total('milliseconds')
  }

  /**
   * Get serializable task data
   */
  get data() {
    const {
      id,
      type,
      params,
      stage,
      status,
      payload,
      createdAt,
      startedAt,
      completedAt,
      duration,
      logs,
      hookToken,
    } = this
    return {
      id,
      type,
      stage,
      createdAt: createdAt.toString(),
      ...(params && { params }),
      ...(status && { status }),
      ...(payload && { payload }),
      ...(startedAt && { startedAt: startedAt.toString(), duration }),
      ...(completedAt && { completedAt: completedAt.toString() }),
      ...(logs && { logs }),
      ...(hookToken && { hookToken }),
    }
  }

  /**
   * Emit a structured log line for this task
   */
  log(message?: string) {
    const { stage, status, type, payload, params } = this.data
    const args: string[] = [status ?? stage, type]
    if (message) args.unshift(message)
    if (params) args.push(`(${params})`)
    const isCaptureImageType = type.startsWith('CaptureImage')
    if (payload?.length && !isCaptureImageType) args.push(`➡️ ${payload}`)
    if (DEBUG) args.push(`(id: ${this.id})`)

    if (isCaptureImageType || type === 'HeartBeat') logger.debug(...args)
    else logger.info(...args)
  }

  /**
   * Transition task to a new stage and notify waiters
   */
  setStage(stage: TaskStage) {
    this.stage = stage
    const resolvers = this.stageResolvers.get(stage) ?? []
    for (const { resolve } of resolvers) {
      resolve(this)
    }
    this.stageResolvers.delete(stage)
  }

  /**
   * Wait for task to reach a specific stage
   *
   * @param stage - Stage to wait for
   * @param timeout - Maximum wait time
   * @returns This task when stage is reached
   * @throws TimeoutError if stage is not reached within timeout
   */
  waitFor = async (stage: TaskStage, timeout: Temporal.DurationLike = { minutes: 1 }) => {
    if (this.stage === stage) return this

    const ms = Temporal.Duration.from(timeout).total('milliseconds')

    return new Promise<WorkflowTask>((resolve, reject) => {
      // Set timeout
      const timeoutId = setTimeout(() => {
        const resolvers = this.stageResolvers.get(stage) ?? []
        const idx = resolvers.findIndex((r) => r.resolve === resolve)
        if (idx >= 0) resolvers.splice(idx, 1)
        reject(new WorkflowTask.TimeoutError(`Task ${this.id} timed out waiting for ${stage}`))
      }, ms)

      // Register resolver
      const resolvers = this.stageResolvers.get(stage) ?? []
      resolvers.push({
        resolve: (task) => {
          clearTimeout(timeoutId)
          resolve(task)
        },
        reject,
      })
      this.stageResolvers.set(stage, resolvers)
    })
  }

  /**
   * Report task completion with status and optional payload
   */
  complete(status: 'SUCCESS' | 'FAILED' | 'CANCELLED', payload?: string) {
    this.status = status
    this.payload = payload
    this.setStage('DONE')
  }

  /**
   * Mark task as started (RUNNING stage)
   */
  start() {
    this.setStage('RUNNING')
  }
}

// Re-export as Task for backward compatibility
export { WorkflowTask as Task }
export type TaskData = WorkflowTask['data']
