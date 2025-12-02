import type { TaskStage, TaskType, ImmediateTask } from './lib/schema'

import { EventEmitter } from 'events'

import { IMMEDIATE_TASK } from './const'
import { DEBUG, logger } from './lib/logger'
import { getNow } from './lib/temporal'

/**
 * Workflow hook callback for resuming workflows
 */
export type WorkflowHookCallback = (payload: {
  status: 'SUCCESS' | 'FAILED' | 'CANCELLED'
  payload?: string
}) => void

/**
 * Runtime representation of a Maa task, including life-cycle state transitions.
 *
 * This class combines EventEmitter-based events with optional workflow hook integration.
 * When a workflow hook is registered, task completion will resume the associated workflow.
 *
 * @remarks
 * Instances of this class emit {@link TaskStage} events and buffer execution metadata to be
 * returned through the Maa remote control protocol.
 *
 * The workflow integration allows tasks to participate in durable workflows that survive
 * server restarts. When a hook is registered via `registerWorkflowHook()`, the task
 * completion will trigger the workflow to resume with the task result.
 */
export class Task extends EventEmitter<Record<TaskStage, [Task]>> {
  public payload?: string
  public status?: 'SUCCESS' | 'FAILED' | 'CANCELLED'
  public stage: TaskStage = 'PENDING'
  public startedAt?: Temporal.ZonedDateTime
  public completedAt?: Temporal.ZonedDateTime
  public logs?: string

  /**
   * Optional workflow hook token for resuming durable workflows
   * When set, task completion will resume the associated workflow
   */
  public workflowHookToken?: string

  /**
   * Workflow hook callback function
   * Called when task completes to resume the workflow
   */
  private workflowHookCallback?: WorkflowHookCallback

  /**
   * Creates a new task and primes it for dispatching.
   * @param type - Domain specific task type as defined by the Maa schema.
   * @param createdAt - Timestamp when task was created.
   * @param params - Optional Maa task payload originating from the controller request.
   * @param id - Unique identifier representing the Maa task instance.
   */
  constructor(
    public type: TaskType,
    public createdAt: Temporal.ZonedDateTime,
    public params: string | undefined = undefined,
    public id = `${type}|${createdAt.toString()}`,
  ) {
    super()
  }

  /**
   * Register a workflow hook to be called when task completes.
   * This enables integration with the Workflow SDK's durable execution.
   *
   * @param token - The workflow hook token for identification
   * @param callback - Function to call when task completes
   */
  registerWorkflowHook(token: string, callback: WorkflowHookCallback) {
    this.workflowHookToken = token
    this.workflowHookCallback = callback
    logger.debug(`[Workflow] Registered hook ${token} for task ${this.id}`)
  }

  /**
   * Check if this task has a workflow hook registered
   */
  get hasWorkflowHook() {
    return !!this.workflowHookCallback
  }

  static RunError = class TaskRunError extends Error {
    name = 'TaskRunError'
  }
  static TimeoutError = class TimeoutError extends Error {
    name = 'TimeoutError'
  }

  static isImmediate = (type: TaskType): type is ImmediateTask =>
    IMMEDIATE_TASK.includes(type as ImmediateTask)

  /**
   * Determines whether the provided task type is configured for immediate execution.
   * @param type - Task type to inspect.
   * @returns `true` when the task type should run synchronously.
   */
  get immediate() {
    return Task.isImmediate(this.type)
  }
  get image() {
    if (this.type === 'CaptureImage' || this.type === 'CaptureImageNow') {
      if (!this.payload) throw new Error('No payload available')
      return Buffer.from(this.payload, 'base64')
    }
  }
  get duration() {
    if (!this.startedAt) return undefined
    const end = this.completedAt ?? getNow()
    return end.since(this.startedAt).total('milliseconds')
  }

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
      workflowHookToken,
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
      ...(workflowHookToken && { workflowHookToken }),
    }
  }

  /**
   * Complete the task and notify any registered workflow hook.
   * This is called internally when the task reaches DONE stage.
   */
  private notifyWorkflowHook() {
    if (this.workflowHookCallback && this.status) {
      try {
        this.workflowHookCallback({
          status: this.status,
          payload: this.payload,
        })
        logger.debug(`[Workflow] Notified hook for task ${this.id} with status ${this.status}`)
      } catch (error) {
        logger.error(`[Workflow] Failed to notify hook for task ${this.id}:`, error)
      }
    }
  }
  /**
   * Emits a structured log line summarizing the current task status.
   * @param message - Optional prefix that adds operator-friendly context.
   */
  log(message?: string) {
    const { stage, status, type, payload, params } = this.data
    const args: string[] = [status ?? stage, type]
    if (message) args.unshift(message)
    if (params) args.push(`(${params})`)
    const isCaptureImageType = type.startsWith('CaptureImage')
    if (payload?.length && !isCaptureImageType) args.push(`➡️ ${payload}`)
    if (DEBUG) args.push(`(id: ${this.id})`)

    // Debug log high-frequency tasks to reduce noise
    if (isCaptureImageType || type === 'HeartBeat') logger.debug(...args)
    else logger.info(...args)
  }
  /**
   * Blocks until the task emits the requested event or the timeout elapses.
   * @param stage - Event name to await.
   * @param timeout - Temporal duration specifying the wait limit. Defaults to one minute.
   * @returns The task instance once the event is observed.
   * @throws {@link Task.TimeoutError} Thrown when the task fails to emit the event in time.
   */
  waitFor = async (stage: TaskStage, timeout: Temporal.DurationLike = { minutes: 1 }) => {
    if (this.stage === stage) return this
    const ms = Temporal.Duration.from(timeout).total('milliseconds')
    const eventPromise = EventEmitter.once(this, stage)
    const timeoutPromise = new Promise((_resolve, reject) =>
      setTimeout(() => reject(new Task.TimeoutError()), ms),
    )
    await Promise.race([eventPromise, timeoutPromise])

    return this
  }

  /**
   * Complete the task with the given status and optional payload.
   * This method handles both EventEmitter notification and workflow hook notification.
   *
   * @param status - Final status of the task
   * @param payload - Optional payload data from task execution
   * @param completedAt - Timestamp when task completed
   */
  complete(
    status: 'SUCCESS' | 'FAILED' | 'CANCELLED',
    payload?: string,
    completedAt?: Temporal.ZonedDateTime,
  ) {
    this.status = status
    this.payload = payload
    this.completedAt = completedAt ?? getNow()
    this.stage = 'DONE'

    // Emit the DONE event for EventEmitter-based listeners
    this.emit('DONE', this)

    // Notify workflow hook if registered
    this.notifyWorkflowHook()
  }

  /**
   * Mark task as started (RUNNING stage)
   *
   * @param startedAt - Timestamp when task started
   */
  start(startedAt?: Temporal.ZonedDateTime) {
    this.startedAt = startedAt ?? getNow()
    this.stage = 'RUNNING'

    // Emit the RUNNING event for EventEmitter-based listeners
    this.emit('RUNNING', this)
  }
}
export type TaskData = Task['data']
