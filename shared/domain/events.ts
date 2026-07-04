/**
 * Domain events emitted by state transitions.
 */

export interface LockAcquiredEvent {
  type: 'LockAcquired'
  source: 'phone' | 'operator'
  expiresAt: string
}

export interface LockRenewedEvent {
  type: 'LockRenewed'
  expiresAt: string
}

export interface LockExpiredEvent {
  type: 'LockExpired'
}

export interface LockReleasedEvent {
  type: 'LockReleased'
  actor: string
}

export interface UnlockCooldownStartedEvent {
  type: 'UnlockCooldownStarted'
  cooldownUntil: string
}

export interface CooldownExpiredEvent {
  type: 'CooldownExpired'
}

export interface RunScheduledEvent {
  type: 'RunScheduled'
  runId: string
  reason: 'manual' | 'soft_due' | 'hard_due'
}

export interface TaskDispatchedEvent {
  type: 'TaskDispatched'
  runId: string
  maaTaskId: string
}

export interface TaskCompletedEvent {
  type: 'TaskCompleted'
  runId: string
  status: 'DONE' | 'FAILED'
  payload?: string | undefined
}

export interface TaskAbortedEvent {
  type: 'TaskAborted'
  runId: string
  reason: 'manual' | 'lock_acquired'
}

export interface TaskLostEvent {
  type: 'TaskLost'
  runId: string
  reason: 'dispatch_lease_expired'
}

export interface AutomationPausedEvent {
  type: 'AutomationPaused'
  actor: string
  reason?: string | undefined
}

export interface AutomationResumedEvent {
  type: 'AutomationResumed'
  actor: string
}

export interface SchedulePolicyUpdatedEvent {
  type: 'SchedulePolicyUpdated'
  actor: string
  patch: Record<string, number>
}

export interface TaskTemplateUpdatedEvent {
  type: 'TaskTemplateUpdated'
  actor: string
  patch: Record<string, string | undefined>
}

export interface LogIngestedEvent {
  type: 'LogIngested'
  lineCount: number
}

export interface RunSkippedEvent {
  type: 'RunSkipped'
  reason: 'next_run_within_window'
}

/**
 * All domain event types.
 */
export type DomainEvent =
  | LockAcquiredEvent
  | LockRenewedEvent
  | LockExpiredEvent
  | LockReleasedEvent
  | UnlockCooldownStartedEvent
  | CooldownExpiredEvent
  | RunScheduledEvent
  | TaskDispatchedEvent
  | TaskCompletedEvent
  | TaskAbortedEvent
  | TaskLostEvent
  | AutomationPausedEvent
  | AutomationResumedEvent
  | SchedulePolicyUpdatedEvent
  | TaskTemplateUpdatedEvent
  | LogIngestedEvent
  | RunSkippedEvent
