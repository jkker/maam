import type { Schedule, TaskType } from './lib/schema'

import { EventEmitter } from 'node:events'

import sharp from 'sharp'
import { ToadScheduler } from 'toad-scheduler'

import { MJPEG_BOUNDARY, T } from './const'
import { dbService } from './lib/db/service'
import { logger } from './lib/logger'
import { getNow } from './lib/temporal'
import { Task, type TaskData } from './Task'
import { TaskSchedule } from './TaskSchedule'

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

type MaaManagerEventMap = {
  lock: [UnlockResult]
  unlock: [LockResult]
  deviceLog: [string[]]
  update: [TaskData[]]
}

export class MaaManager extends EventEmitter<MaaManagerEventMap> {
  tasks = new Map<string, Task>()
  queue: Task[] = []
  scheduler = new ToadScheduler()
  locked = false
  logs: string[] = []

  // Screenshot polling state
  private screenshotPollingInterval?: NodeJS.Timeout
  // MJPEG stream controllers
  private streams = new Set<ReadableStreamDefaultController<Uint8Array>>()

  // Delayed unlock state
  private unlockTimerId?: NodeJS.Timeout
  private unlockScheduledFor?: Temporal.ZonedDateTime

  /**
   * @param device - Allowed Maa device identifier.
   * @param user - Authorized Maa user.
   * @param tz - Optional IANA timezone used when stamping tasks and schedules.
   */
  constructor(
    public device: string,
    public user: string,
    private tz = Temporal.Now.timeZoneId(),
    private intervalMs = 1_000,
  ) {
    super()

    // Initialize manager state in database
    void this.initializeDatabase()

    // Start garbage collection for stale tasks
    // this.startGarbageCollection()
  }

  /**
   * Initialize database and restore state from database
   */
  private async initializeDatabase() {
    try {
      // Save or update manager state
      await dbService.saveManagerState(this.device, this.user, this.tz, this.locked)

      // Restore schedules from database
      const savedSchedules = await dbService.getSchedulesByDevice(this.device)
      for (const schedule of savedSchedules) {
        // Re-create schedule without re-saving to database
        const job = new TaskSchedule(
          schedule.type as TaskType,
          schedule.hour,
          schedule.minute,
          schedule.timezone || this.tz,
          () => this.create(schedule.type as TaskType, schedule.params || undefined),
        )

        // Restore execution metadata
        if (schedule.lastRunTime) {
          job.lastRunTime = Temporal.ZonedDateTime.from(schedule.lastRunTime)
        }
        if (schedule.runCount) {
          job.runCount = schedule.runCount
        }

        this.scheduler.addCronJob(job)
        logger.info(`Restored schedule ${job.id} from database`)
      }

      logger.info(`Manager ${this.device} initialized from database`)
    } catch (error) {
      logger.error(`Failed to initialize manager from database:`, error)
    }
  }

  /**
   * Creates a new task instance and appends it to the dispatch queue.
   * Prevents duplicate tasks from being queued.
   * @param type - Maa task type to create.
   * @param params - Optional Maa task payload.
   * @returns The newly created {@link Task}.
   */
  create(type: TaskType, params?: string) {
    if (this.locked && !Task.isImmediate(type))
      throw new Error('Manager locked, cannot dispatch queued tasks')

    // Check for duplicate tasks in queue (prevent queuing the same task multiple times)
    const pendingDuplicate = this.queue.find(
      (t) => t.type === type && t.params === params && t.stage === 'PENDING',
    )
    if (pendingDuplicate) {
      logger.warn(`Duplicate task ${type} already in queue, returning existing task`)
      return pendingDuplicate
    }

    // Check for running tasks of the same type
    const runningDuplicate = Array.from(this.tasks.values()).find(
      (t) => t.type === type && t.params === params && t.stage === 'RUNNING',
    )
    if (runningDuplicate) {
      logger.warn(`Task ${type} is already running, returning existing task`)
      return runningDuplicate
    }

    const now = getNow(this.tz)

    const task = new Task(`${type}|${now.toString()}`, type, params)
    this.tasks.set(task.id, task)
    this.queue.push(task)

    task.log()

    // Persist to database (async, non-blocking)
    if (!task.immediate) {
      dbService.saveTask(task.data, this.device).catch((error) => {
        logger.error(`Failed to persist task ${task.id} to database:`, error)
      })
      this.emit('update', this.state)
    }
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

    // Persist schedule to database (async, non-blocking)
    dbService.saveSchedule(job.data, this.device).catch((error) => {
      logger.error(`Failed to persist schedule ${job.id} to database:`, error)
    })

    return job.data
  }
  /**
   * Removes a previously registered cron schedule by identifier.
   * @param id - Cron job identifier returned from MaaManager.addSchedule
   */
  removeSchedule(id: string) {
    const scheduleData = (this.scheduler.removeById(id) as TaskSchedule | undefined)?.data

    // Remove from database (async, non-blocking)
    if (scheduleData) {
      dbService.deleteSchedule(id).catch((error) => {
        logger.error(`Failed to delete schedule ${id} from database:`, error)
      })
    }

    return scheduleData
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

    // Cancel any pending delayed unlock
    if (this.unlockTimerId) {
      clearTimeout(this.unlockTimerId)
      this.unlockTimerId = undefined
      this.unlockScheduledFor = undefined
      logger.info('Cancelled pending delayed unlock due to lock request')
    }

    // Persist lock state to database (async, non-blocking)
    dbService.updateManagerLockState(this.device, true).catch((error) => {
      logger.error(`Failed to update lock state in database:`, error)
    })

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
    this.emit('update', this.state)
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

    // Persist unlock state to database (async, non-blocking)
    dbService.updateManagerLockState(this.device, false).catch((error) => {
      logger.error(`Failed to update unlock state in database:`, error)
    })

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
    this.emit('update', this.state)

    return result
  }

  /**
   * Schedules a delayed unlock after the specified duration.
   * Cancels any existing scheduled unlock.
   * @param delay - Duration to wait before unlocking (default: 10 minutes)
   * @returns Information about when the unlock will occur
   */
  public scheduleUnlock(delay: Temporal.DurationLike = { minutes: 10 }): {
    scheduledFor: Temporal.ZonedDateTime
    delayDuration: Temporal.Duration
  } {
    // Cancel existing unlock timer if any
    if (this.unlockTimerId) {
      clearTimeout(this.unlockTimerId)
      logger.info('Cancelled previous delayed unlock')
    }

    const now = getNow()
    const delayDuration = Temporal.Duration.from(delay)
    const scheduledFor = now.add(delayDuration)
    this.unlockScheduledFor = scheduledFor

    const delayMs = delayDuration.total('milliseconds')
    logger.info(`Scheduling unlock for ${scheduledFor.toString()} (in ${delayDuration.toString()})`)

    this.unlockTimerId = setTimeout(async () => {
      logger.info('Executing delayed unlock')
      this.unlockTimerId = undefined
      this.unlockScheduledFor = undefined
      await this.unlock()
    }, delayMs)

    return { scheduledFor, delayDuration }
  }

  /**
   * Cancels a scheduled delayed unlock if one exists.
   * @returns true if a scheduled unlock was cancelled, false otherwise
   */
  public cancelScheduledUnlock(): boolean {
    if (this.unlockTimerId) {
      clearTimeout(this.unlockTimerId)
      this.unlockTimerId = undefined
      this.unlockScheduledFor = undefined
      logger.info('Cancelled scheduled unlock')
      return true
    }
    return false
  }
  public get state() {
    return Array.from(this.tasks.values())
      .filter((t) => !t.immediate)
      .map(({ data }) => data)
  }

  /**
   * Gets the currently running task (if any)
   * @returns The running task data or undefined
   */
  public getRunningTask(): TaskData | undefined {
    const runningTask = Array.from(this.tasks.values()).find(
      (t) => t.stage === 'RUNNING' && !t.immediate,
    )
    return runningTask?.data
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

    // Persist device log to database (async, non-blocking)
    const timestamp = getNow().toString()
    dbService.saveDeviceLog(this.device, timestamp, 'Device Log', text).catch((error) => {
      logger.error(`Failed to save device log to database:`, error)
    })

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
    task.emit('DONE', task)
    task.log()

    // Persist task completion to database (async, non-blocking)
    if (!task.immediate) {
      dbService.updateTask(task.data, this.device).catch((error) => {
        logger.error(`Failed to update task ${task.id} in database:`, error)
      })
      this.emit('update', this.state)
    }

    return task
  }

  public getTask() {
    const tasks = this.queue.map((task) => {
      task.stage = 'RUNNING'
      task.startedAt = getNow()
      task.emit('RUNNING', task)
      task.log()

      // Persist task state update to database (async, non-blocking)
      if (!task.immediate) {
        dbService.updateTask(task.data, this.device).catch((error) => {
          logger.error(`Failed to update task ${task.id} in database:`, error)
        })
      }

      const { id, type, params } = task
      return { id, type, ...(params && { params }) }
    })
    this.queue = []
    return tasks
  }

  public async getScreenshotJPEG() {
    const { payload } = await this.create('CaptureImageNow').waitFor('DONE', { seconds: 10 })
    if (!payload) throw new Error('No screenshot payload received')

    // Convert Base64 PNG to JPEG buffer
    const pngBuffer = Buffer.from(payload, 'base64')
    const jpegBuffer = await sharp(pngBuffer).jpeg({ quality: 100 }).keepExif().toBuffer()
    return jpegBuffer as Buffer<ArrayBuffer>
  }

  private startScreenshotPolling() {
    if (this.screenshotPollingInterval)
      return void logger.debug('Screenshot polling already active, skipping start')

    let isRunning = false

    logger.info(`Starting screenshot polling at ${this.intervalMs}ms interval`)
    this.screenshotPollingInterval = setInterval(async () => {
      if (isRunning) return
      isRunning = true
      try {
        const buffer = await this.getScreenshotJPEG()
        // Write JPEG frame to all active stream controllers
        if (this.streams.size === 0) return

        // Writes a JPEG frame to all active stream controllers with proper multipart formatting
        const encoder = new TextEncoder()

        const frameHeader = encoder.encode(
          [
            MJPEG_BOUNDARY,
            `Content-Type: image/jpeg`,
            `Content-Length: ${buffer.length}`,
            '',
            '',
          ].join('\r\n'),
        )
        const frameEnd = encoder.encode('\r\n')

        // Write to all controllers, removing any that error
        const controllersToRemove: ReadableStreamDefaultController<Uint8Array>[] = []

        for (const controller of this.streams) {
          try {
            controller.enqueue(frameHeader)
            controller.enqueue(buffer)
            controller.enqueue(frameEnd)
          } catch (error) {
            logger.error('Error writing to stream controller:', error)
            controllersToRemove.push(controller)
          }
        }

        // Clean up failed controllers
        for (const controller of controllersToRemove) {
          this.streams.delete(controller)
        }
        if (this.streams.size === 0) this.stopScreenshotPolling()
      } catch (error) {
        logger.error('Screenshot polling error:', error)
      } finally {
        isRunning = false
      }
    }, this.intervalMs)
  }

  /**
   * Stops screenshot polling interval if no more active subscribers
   */
  private stopScreenshotPolling() {
    if (!this.screenshotPollingInterval) return

    logger.info('Stopping screenshot polling')
    clearInterval(this.screenshotPollingInterval)
    this.screenshotPollingInterval = undefined
  }

  public createStream() {
    let controller: ReadableStreamDefaultController<Uint8Array>
    return new ReadableStream<Uint8Array>({
      start: (c) => {
        controller = c
        this.streams.add(controller)
        logger.info(`Added stream controller. Active streams: ${this.streams.size}`)
        // Start screenshot polling if this is the first stream
        if (this.streams.size === 1) this.startScreenshotPolling()
      },
      cancel: () => {
        logger.info(`Closing mjpeg stream controller. Active streams: ${this.streams.size}`)
        if (!controller) return
        this.streams.delete(controller)
        if (this.streams.size === 0) this.stopScreenshotPolling()
      },
    })
  }

  public async *listen<K extends keyof MaaManagerEventMap>(
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
