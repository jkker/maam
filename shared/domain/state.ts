/**
 * Schedule policy configuration for an automation instance.
 */
export interface SchedulePolicy {
  /** Soft interval between runs (default 8h) */
  softIntervalMs: number
  /** Hard upper bound interval (default 16h) */
  hardIntervalMs: number
  /** Delay after phone unlock before next run (default 30m) */
  postUnlockDelayMs: number
  /** Duration of lock lease before auto-expiry (default 4h) */
  lockLeaseMs: number
  /** Skip early run if next scheduled run is within this window (default 1h) */
  skipIfNextRunWithinMs: number
}

/**
 * Task template configuration.
 */
export interface TaskTemplate {
  /** MAA task type (e.g., "LinkStart") */
  maaTaskType: string
  /** Optional task parameters */
  params?: string
}

/**
 * Lock lease information.
 */
export interface LockLease {
  /** Revision for optimistic concurrency */
  revision?: number | undefined
  /** Source of the lock */
  source: 'phone' | 'operator'
  /** When lock was acquired */
  acquiredAt: string
  /** When lock expires automatically */
  expiresAt: string
}

/**
 * Current run state.
 * Note: We never use "RUNNING" as MAA doesn't provide a real start acknowledgment.
 */
export type RunState = 'PENDING_DISPATCH' | 'DISPATCHED' | 'ABORTING'

/**
 * Final run status.
 */
export type RunFinalStatus = 'DONE' | 'FAILED' | 'ABORTED' | 'LOST'

/**
 * Current run tracking.
 */
export interface CurrentRun {
  /** Unique run identifier */
  runId: string
  /** MAA task ID sent to client */
  maaTaskId: string
  /** Generation counter for detecting stale reports */
  generation: number
  /** Current state */
  state: RunState
  /** When task was dispatched to client */
  dispatchedAt?: string
  /** Deadline for dispatch lease */
  dispatchLeaseExpiresAt?: string
  /** When abort was requested */
  abortRequestedAt?: string
}

/**
 * Complete instance state.
 * This is the single source of truth for one automation instance.
 */
export interface InstanceState {
  /** Instance identifier (${user}:${device}) */
  instanceId: string
  /** State version for optimistic concurrency */
  version: number

  /** Whether automation is paused */
  paused: boolean
  /** Reason for pause (if paused) */
  pauseReason?: string | undefined

  /** Scheduling policy configuration */
  schedulePolicy: SchedulePolicy

  /** Task template to dispatch */
  taskTemplate: TaskTemplate

  /** Active lock lease (blocks automation) */
  lockLease?: LockLease | undefined

  /** Cooldown until (ISO string) */
  cooldownUntil?: string | undefined

  /** Last successful run completion time */
  lastSuccessAt?: string | undefined
  /** Last run finish time (regardless of outcome) */
  lastFinishAt?: string | undefined

  /** Current active run (if any) */
  currentRun?: CurrentRun | undefined

  /** Next alarm wake time (ISO string) */
  nextWakeAt?: string | undefined
}

/**
 * Default schedule policy values.
 */
export const DEFAULT_SCHEDULE_POLICY: SchedulePolicy = {
  softIntervalMs: 8 * 60 * 60 * 1000, // 8 hours
  hardIntervalMs: 16 * 60 * 60 * 1000, // 16 hours
  postUnlockDelayMs: 30 * 60 * 1000, // 30 minutes
  lockLeaseMs: 4 * 60 * 60 * 1000, // 4 hours
  skipIfNextRunWithinMs: 1 * 60 * 60 * 1000, // 1 hour
}

/**
 * Creates initial state for a new instance.
 */
export function createInitialState(instanceId: string): InstanceState {
  return {
    instanceId,
    version: 0,
    paused: false,
    schedulePolicy: { ...DEFAULT_SCHEDULE_POLICY },
    taskTemplate: {
      maaTaskType: 'LinkStart',
    },
  }
}
