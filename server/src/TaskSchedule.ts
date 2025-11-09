import type { TaskType } from './lib/schema'

import { CronJob, Task as ScheduledTask } from 'toad-scheduler'

import { logger } from './lib/logger'
import { getNow } from './lib/temporal'

type TaskScheduleOptions = {
  params?: string
  onStateChange?: (schedule: TaskSchedule) => void
}

export class TaskSchedule extends CronJob {
  readonly id: string
  public lastRunTime?: Temporal.ZonedDateTime
  public runCount: number = 0
  public cooldownUntil?: Temporal.ZonedDateTime
  public params?: string

  constructor(
    public type: TaskType,
    public hour: number,
    public minute: number,
    public timezone: string,
    handler: () => void,
    { params, onStateChange }: TaskScheduleOptions = {},
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
          onStateChange?.(this)
          return
        }
        this.lastRunTime = getNow(this.timezone)
        this.runCount += 1
        logger.info(`Executing scheduled task ${this.id} (run #${this.runCount})`)
        onStateChange?.(this)
        try {
          handler()
        } catch (error) {
          logger.error(`Scheduled task ${this.id} failed:`, error)
        }
      }),
      { preventOverrun: true, id },
    )
    this.id = id
    this.params = params
  }

  get data() {
    return {
      id: this.id,
      type: this.type,
      hour: this.hour,
      minute: this.minute,
      timezone: this.timezone,
      ...(this.params && { params: this.params }),
      ...(this.lastRunTime && { lastRunTime: this.lastRunTime.toString() }),
      ...(this.runCount && { runCount: this.runCount }),
      ...(this.cooldownUntil && { cooldownUntil: this.cooldownUntil.toString() }),
    }
  }
}

export type ScheduleData = TaskSchedule['data']
