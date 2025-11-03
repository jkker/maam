import type { TaskType } from './lib/schema'

import { CronJob, Task as ScheduledTask } from 'toad-scheduler'

import { logger } from './lib/logger'
import { getNow } from './lib/temporal'

export class TaskSchedule extends CronJob {
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
