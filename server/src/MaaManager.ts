import { EventEmitter } from 'node:events'

import { CronJob, Task as ScheduledTask, ToadScheduler } from 'toad-scheduler'

import { DEBUG, logger } from './lib/logger'

import {
  IMMEDIATE_TASK,
  T,
  type ImmediateTask,
  type Schedule,
  type TaskStage,
  type TaskType,
} from './lib/schema'

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

class TaskSchedule extends CronJob {
  readonly id: string
  public lastRunTime?: Temporal.ZonedDateTime
  public runCount: number = 0

  public cooldownUntil?: Temporal.ZonedDateTime

  constructor(
    public type: TaskType,
    public hour: number,
    public minute: number,
    public timezone: string,
    handler: () => void,
  ) {
    const id = `${type}|${hour}:${minute}`

    // Runs daily at specified hour and minute
    super(
      { cronExpression: `0 ${minute} ${hour} * * *`, timezone },
      new ScheduledTask(`task-${id}`, () => {
        if (this.cooldownUntil) {
          logger.info(
            `Skipping scheduled task ${this.id} due to active cooldown until ${this.cooldownUntil.toString()}`,
          )
          delete this.cooldownUntil
          return
        }
        this.lastRunTime = getNow()
        this.runCount += 1
        logger.info(`Executing scheduled task ${this.id} (run #${this.runCount})`)
        try {
          handler()
        } catch (error) {
          logger.error(`Scheduled task ${this.id} failed:`, error)
        }
      }),
      { preventOverrun: true, id },
    )
    this.id = id
  }

  get data() {
    return {
      id: this.id,
      type: this.type,
      hour: this.hour,
      minute: this.minute,
      timezone: this.timezone,
      ...(this.lastRunTime && { lastRunTime: this.lastRunTime.toString() }),
      ...(this.runCount && { runCount: this.runCount }),
    }
  }

  get nextRunTime() {
    const t = getNow()
    const next = t.withPlainTime({ hour: this.hour, minute: this.minute })
    // If time has passed today, schedule for tomorrow
    if (Temporal.ZonedDateTime.compare(next, t) <= 0) return next.add({ days: 1 })
    return next
  }
}

export type ScheduleData = TaskSchedule['data']

export type ConnectionSnapshot = {
  timestamp: string
  connected: boolean
  screenshot?: string
}

export type UnlockResult = {
  success: boolean
  nextSchedule?: {
    durationUntil: Temporal.Duration
    task: TaskType
    nextRunTime: Temporal.ZonedDateTime
  }
  message: string
}

export type LockResult = {
  success: boolean
  message: string
  stoppedTask?: TaskData
}
type ManagerState = {
  locked: boolean
  tasks: TaskData[]
  logs: string[]
}
type MaaManagerEventKey = keyof MaaManagerEventMap

type MaaManagerEventMap = {
  lock: [UnlockResult]
  unlock: [LockResult]
  taskDispatched: [TaskData]
  taskCompleted: [TaskData]
  deviceLog: [string[]]
  screenshot: [ConnectionSnapshot]
  newListener: [MaaManagerEventKey]
  removeListener: [MaaManagerEventKey]
  update: [ManagerState]
}

export class MaaManager extends EventEmitter<MaaManagerEventMap> {
  tasks = new Map<string, Task>()
  queue: Task[] = []
  scheduler = new ToadScheduler()
  locked = false
  logs: string[] = []

  // Screenshot polling state
  private screenshotIntervalId?: NodeJS.Timeout
  private screenshotTimestamps: number[] = []
  private readonly MAX_TIMESTAMP_HISTORY = 10
  private estimatedIntervalMs?: number

  /**
   * @param device - Allowed Maa device identifier.
   * @param user - Authorized Maa user.
   * @param tz - Optional IANA timezone used when stamping tasks and schedules.
   */
  constructor(
    public device: string,
    public user: string,
    private tz = Temporal.Now.timeZoneId(),
    private intervalMs = 2000,
  ) {
    super()

    this.on('newListener', (event) => {
      if (event === 'screenshot' && this.listenerCount('screenshot') === 0) {
        this.startScreenshotPolling()
      }
    })

    this.on('removeListener', (event) => {
      if (event === 'screenshot' && this.listenerCount('screenshot') === 0) {
        this.stopScreenshotPolling()
      }
    })
  }

  emit<K>(
    eventName: keyof MaaManagerEventMap | K,
    ...args: K extends keyof MaaManagerEventMap ? MaaManagerEventMap[K] : never
  ): boolean {
    const res = super.emit(eventName as MaaManagerEventKey, ...args)
    if (eventName !== 'update') super.emit('update', this.state)
    return res
  }

  /**
   * Creates a new task instance and appends it to the dispatch queue.
   * @param type - Maa task type to create.
   * @param params - Optional Maa task payload.
   * @returns The newly created {@link Task}.
   */
  create(type: TaskType, params?: string) {
    if (this.locked && !Task.isImmediate(type))
      throw new Error('Manager locked, cannot dispatch queued tasks')

    const now = Temporal.Now.instant().toZonedDateTimeISO(this.tz)

    const id = `${type}|${now.toString()}`
    const task = new Task(id, type, params)
    this.tasks.set(task.id, task)
    this.queue.push(task)

    task.log()
    return task
  }

  /**
   * Registers a cron schedule that periodically enqueues the provided task.
   * @param schedule - Maa schedule descriptor containing timing metadata.
   * @returns Deterministic identifier for the cron job, used to manage its lifecycle.
   */
  addSchedule({ task, hour, minute = 0, params, timezone = this.tz }: Schedule) {
    const job = new TaskSchedule(task, hour, minute, timezone, () => this.create(task, params))
    this.scheduler.addCronJob(job)
    return job.data
  }
  /**
   * Removes a previously registered cron schedule by identifier.
   * @param id - Cron job identifier returned from MaaManager.addSchedule
   */
  removeSchedule(id: string) {
    return (this.scheduler.removeById(id) as TaskSchedule | undefined)?.data
  }

  get schedules() {
    return this.scheduler.getAllJobs().filter((job) => job instanceof TaskSchedule)
  }

  async stop() {
    await this.create('StopTask').waitFor('DONE')
  }

  async start() {
    if (this.locked) return { success: false, message: 'Manager is locked' }
    await this.create('LinkStart').waitFor('RUNNING')
    return { success: true, message: 'LinkStart task started' }
  }

  /**
   * Places the manager into a locked state, halting queue processing and schedules.
   * @returns Information about any stopped task
   */
  public async lock(): Promise<LockResult> {
    this.locked = true

    // Pause all schedules
    this.scheduler.stop()
    const { schedules } = this
    logger.info(`Pausing ${schedules.length} schedules.`)

    let isRunning = false,
      success = true,
      message = '',
      stoppedTask: Task | undefined

    const { payload: runningId } = await this.create('HeartBeat').waitFor('DONE')

    // Stop running task
    if (runningId) {
      isRunning = true

      if ((stoppedTask = this.tasks.get(runningId))) {
        const { id, type, duration } = stoppedTask
        logger.warn(`Stopping running task: ${id}`)
        stoppedTask.status = 'CANCELLED'
        message = `${T[type]} 运行了${duration}分钟。`
      } else message = `未知任务${runningId}正在运行。`
    } else message = '所有任务均已停止。'

    // Clear pending queue
    if (this.queue.length > 0) {
      logger.warn(
        `Removing ${this.queue.length} pending tasks:`,
        this.queue.map(({ id }) => id),
      )
      isRunning = true
      this.queue.forEach((task) => (task.status = 'CANCELLED'))
      this.queue = []
    }

    // Wait for running task to stop
    if (!isRunning) message = 'MAA已收监！' + message
    else {
      await this.create('StopTask').waitFor('DONE')
      const { payload: runningId } = await this.create('HeartBeat').waitFor('DONE')
      if (runningId) {
        logger.error(`Failed to stop running task: ${runningId}`)
        success = false
        message = 'MAA已失控！' + message
      } else message = 'MAA已收监！' + message
    }

    const result: LockResult = { success, stoppedTask: stoppedTask?.data, message }
    this.emit('lock', result)

    return result
  }
  private unlockTime?: Temporal.ZonedDateTime

  /**
   * Releases the manager lock and resumes paused schedules.
   * @returns Information about next scheduled task and cooldown impact
   */
  public async unlock(cooldown: Temporal.DurationLike = { minutes: 10 }): Promise<UnlockResult> {
    this.locked = false
    this.unlockTime = getNow()
    const { schedules } = this
    logger.info(`Manager unlocked. Resumed ${schedules.length} schedules.`)

    // Calculate next scheduled task
    const cooldownEnd = this.unlockTime.add(cooldown)

    let nextSchedule:
      | {
          durationUntil: Temporal.Duration
          task: TaskType
          nextRunTime: Temporal.ZonedDateTime
        }
      | undefined

    let message = `嗷！MAA已出笼！`

    // Restart all jobs and apply cooldown where necessary
    for (const schedule of schedules) {
      schedule.start()

      // Calculate next run time for this schedule
      const { nextRunTime } = schedule
      const durationUntil = this.unlockTime.until(nextRunTime)
      const affectedByCooldown = Temporal.ZonedDateTime.compare(nextRunTime, cooldownEnd) < 0

      // Apply cooldown if this schedule would run within cooldown period
      if (affectedByCooldown) {
        logger.info(
          `Schedule ${schedule.id} next run at ${nextRunTime.toString()} is ${durationUntil.toString()} away. Applying cooldown.`,
        )
        schedule.cooldownUntil = cooldownEnd
      }
      nextSchedule ??= { nextRunTime, durationUntil, task: schedule.type }
    }

    let result: UnlockResult
    try {
      await this.create('HeartBeat').waitFor('DONE')
      if (nextSchedule) {
        message += `下次任务将在`
        const { hours, minutes } = nextSchedule.durationUntil
        if (hours > 0) message += `${hours}小时`
        if (minutes > 0) message += `${minutes}分钟`
        message += `后执行。`
      }
      result = { success: true, nextSchedule, message }
    } catch {
      message += '但是它好像噶了。'
      logger.error('Failed to verify HeartBeat after unlocking manager.')
      result = { success: false, nextSchedule, message }
    }
    this.emit('unlock', result)
    return result
  }

  public get state(): ManagerState {
    return {
      locked: this.locked,
      tasks: Array.from(this.tasks.values())
        .filter((t) => !t.immediate)
        .map(({ data }) => data),
      logs: this.logs.slice(-50),
    }
  }

  public deviceLog(text: string) {
    // replace "\n" with actual newlines and trim whitespace
    text = text.replace(/\\n/g, '\n')
    text = text.replaceAll('[TraceLogBrush]', '\t')
    text = text.replaceAll('[MAA]', '')
    // add newlines before all `[MM-DD` timestamps
    text = text.replaceAll(/\[(\d{1,2}-)/g, '\n$1')
    text = text.replaceAll(/(\d{1,2})\]/g, '$1')
    // replace multiple newlines with a single newline
    text = text.replaceAll(/\n+/g, '\n').trim()
    // replace multiple tabs with a single tab
    text = text.replaceAll(/\t+/g, '\t').trim()
    // split and trim each line
    text = text
      .split('\n')
      .map((line) => line.trim())
      .join('\n')
    this.logs.push(text)
    logger.info(`Received MAA Log:\n`, text)
    this.emit('deviceLog', this.logs)
  }

  public reportStatus({
    task: id,
    status,
    payload,
  }: Pick<Task, 'status' | 'payload'> & { task: string }) {
    const task = this.tasks.get(id)
    if (!task) return

    task.stage = 'DONE'
    task.completedAt = getNow()
    if (payload) task.payload = payload
    if (status) task.status = status

    this.queue = this.queue.filter((t) => t.id !== id)
    this.emit('taskCompleted', task.data)
    task.emit('DONE', task)
    task.log()
    return task
  }

  public getTask() {
    const tasks = this.queue.map((task) => {
      task.stage = 'RUNNING'
      task.startedAt = getNow()
      task.emit('RUNNING', task)
      task.log()
      const { id, type, params } = task
      return { id, type, ...(params && { params }) }
    })
    this.queue = []
    return tasks
  }

  /**
   * Records a screenshot timestamp and calculates estimated interval
   */
  private recordScreenshotTimestamp(timestamp: number) {
    this.screenshotTimestamps.push(timestamp)
    
    // Keep only recent history
    if (this.screenshotTimestamps.length > this.MAX_TIMESTAMP_HISTORY) {
      this.screenshotTimestamps.shift()
    }
    
    // Calculate estimated interval if we have at least 2 timestamps
    if (this.screenshotTimestamps.length >= 2) {
      const intervals: number[] = []
      for (let i = 1; i < this.screenshotTimestamps.length; i++) {
        intervals.push(this.screenshotTimestamps[i] - this.screenshotTimestamps[i - 1])
      }
      
      // Use moving average of intervals
      const sum = intervals.reduce((acc, val) => acc + val, 0)
      this.estimatedIntervalMs = Math.round(sum / intervals.length)
      
      logger.debug(`Estimated screenshot interval: ${this.estimatedIntervalMs}ms (based on ${intervals.length} samples)`)
    }
  }

  /**
   * Gets the estimated screenshot refresh interval
   */
  public getEstimatedInterval(): { intervalMs?: number; confidence: number } {
    const sampleCount = this.screenshotTimestamps.length - 1 // intervals = timestamps - 1
    
    // Confidence increases with more samples, maxing at 1.0 when we have full history
    const confidence = sampleCount > 0 
      ? Math.min(sampleCount / (this.MAX_TIMESTAMP_HISTORY - 1), 1.0)
      : 0
    
    return {
      intervalMs: this.estimatedIntervalMs,
      confidence
    }
  }

  private startScreenshotPolling() {
    if (this.screenshotIntervalId) {
      logger.debug('Screenshot polling already active, skipping start')
      return
    }
    let isRunning = false

    logger.info(`Starting screenshot polling at ${this.intervalMs}ms interval`)
    this.screenshotIntervalId = setInterval(async () => {
      if (isRunning) return
      isRunning = true
      try {
        const { payload, completedAt } = await this.create('CaptureImageNow').waitFor('DONE', {
          seconds: 10,
        })
        if (!payload || !completedAt) throw new Error('No screenshot payload received')

        // Record timestamp for interval estimation
        const timestamp = Date.now()
        this.recordScreenshotTimestamp(timestamp)

        this.emit('screenshot', {
          screenshot: payload,
          timestamp: completedAt.toString(),
          connected: true,
        })
      } catch (error) {
        logger.error('Screenshot polling error:', error)
        this.emit('screenshot', {
          timestamp: getNow().toString(),
          connected: false,
          screenshot: undefined,
        })
      } finally {
        isRunning = false
      }
    }, this.intervalMs)
  }

  /**
   * Stops screenshot polling interval if no more active subscribers
   */
  private stopScreenshotPolling() {
    if (!this.screenshotIntervalId) return

    logger.info('Stopping screenshot polling')
    clearInterval(this.screenshotIntervalId)
    this.screenshotIntervalId = undefined
  }

  public async *listen<K extends MaaManagerEventKey>(
    event: K,
    options?: Parameters<typeof EventEmitter.on>[2],
  ) {
    logger.debug(`Client subscribed to ${event}`)
    for await (const [arg] of EventEmitter.on(this, event, options)) {
      yield arg as MaaManagerEventMap[K][0]
    }
    logger.debug(`Client unsubscribed from ${event}`)
  }
}
