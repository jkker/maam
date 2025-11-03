import type { TaskStage, TaskType, ImmediateTask } from './lib/schema'

import { EventEmitter } from 'events'

import { IMMEDIATE_TASK } from './const'
import { DEBUG, logger } from './lib/logger'
import { getNow } from './lib/temporal'

/**
 * Runtime representation of a Maa task, including life-cycle state transitions.
 * @remarks
 * Instances of this class emit {@link TaskStage} events and buffer execution metadata to be
 * returned through the Maa remote control protocol.
 */

export class Task extends EventEmitter<Record<TaskStage, [Task]>> {
  public payload?: string
  public status?: 'SUCCESS' | 'FAILED' | 'CANCELLED'
  public stage: TaskStage = 'PENDING'
  public createdAt: Temporal.ZonedDateTime
  public startedAt?: Temporal.ZonedDateTime
  public completedAt?: Temporal.ZonedDateTime
  /**
   * Creates a new task and primes it for dispatching.
   * @param id - Unique identifier representing the Maa task instance.
   * @param type - Domain specific task type as defined by the Maa schema.
   * @param params - Optional Maa task payload originating from the controller request.
   */
  constructor(
    public id: string,
    public type: TaskType,
    public params: string | undefined = undefined,
  ) {
    super()
    this.createdAt = getNow()
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
}
export type TaskData = Task['data']
