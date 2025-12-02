import type { TaskType } from './lib/schema'

import { CronJob, Task as ScheduledTask } from 'toad-scheduler'

import { logger } from './lib/logger'
import { getNow } from './lib/temporal'

type TaskScheduleOptions = {
  params?: string
  onStateChange?: (schedule: TaskSchedule) => void
}

/**
 * TaskSchedule - Cron-based task scheduling with workflow integration
 *
 * This class manages scheduled task execution using toad-scheduler for cron jobs.
 * It integrates with the workflow system by:
 * - Tracking workflow run IDs for each scheduled execution
 * - Supporting cooldown periods to prevent rapid re-execution
 * - Maintaining execution history for audit and debugging
 *
 * The workflow integration enables:
 * - Durable scheduling that survives server restarts (via workflow persistence)
 * - Correlation between scheduled tasks and their workflow runs
 * - Better observability of scheduled task execution
 */
export class TaskSchedule extends CronJob {
  readonly id: string
  public lastRunTime?: Temporal.ZonedDateTime
  public runCount: number = 0
  public cooldownUntil?: Temporal.ZonedDateTime
  public params?: string

  /**
   * Last workflow run ID for tracking durable workflow execution
   */
  public lastWorkflowRunId?: string

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
          const now = getNow(this.timezone)
          if (Temporal.ZonedDateTime.compare(now, this.cooldownUntil) < 0) {
            logger.info(
              `Skipping scheduled task ${this.id} due to active cooldown until ${this.cooldownUntil.toString()}`,
            )
            return
          }
          // Cooldown expired, clear it
          delete this.cooldownUntil
          onStateChange?.(this)
        }
        this.lastRunTime = getNow(this.timezone)
        this.runCount += 1
        logger.info(`[Workflow] Executing scheduled task ${this.id} (run #${this.runCount})`)
        onStateChange?.(this)
        try {
          handler()
        } catch (error) {
          logger.error(`[Workflow] Scheduled task ${this.id} failed:`, error)
        }
      }),
      { preventOverrun: true, id },
    )
    this.id = id
    this.params = params
  }

  /**
   * Get serializable schedule data including workflow tracking info
   */
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
      ...(this.lastWorkflowRunId && { lastWorkflowRunId: this.lastWorkflowRunId }),
    }
  }

  /**
   * Set workflow run ID for the current execution
   * This is used to correlate scheduled tasks with their workflow runs
   */
  setWorkflowRunId(runId: string) {
    this.lastWorkflowRunId = runId
    logger.debug(`[Workflow] Schedule ${this.id} associated with workflow run ${runId}`)
  }
}

export type ScheduleData = TaskSchedule['data']
