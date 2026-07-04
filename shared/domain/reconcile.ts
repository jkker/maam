import type { Command } from './commands'
import type { DomainEvent } from './events'
import type { CurrentRun, InstanceState, LockLease } from './state'

/**
 * Result of applying a command to state.
 */
export interface ReconcileResult {
  state: InstanceState
  events: DomainEvent[]
}

/**
 * Generate a unique run ID.
 */
function generateRunId(): string {
  return `run_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

/**
 * Generate a unique MAA task ID.
 */
function generateMaaTaskId(): string {
  return crypto.randomUUID()
}

/**
 * Calculate the next wake time based on current state.
 */
function calculateNextWake(state: InstanceState, nowMs: number): string | undefined {
  const candidates: number[] = []

  // Lock lease expiry
  if (state.lockLease) {
    candidates.push(new Date(state.lockLease.expiresAt).getTime())
  }

  // Cooldown expiry
  if (state.cooldownUntil) {
    candidates.push(new Date(state.cooldownUntil).getTime())
  }

  // Dispatch lease expiry
  if (state.currentRun?.dispatchLeaseExpiresAt) {
    candidates.push(new Date(state.currentRun.dispatchLeaseExpiresAt).getTime())
  }

  // Next soft due time (if not blocked)
  if (!state.paused && !state.lockLease && !state.cooldownUntil && !state.currentRun) {
    const lastRun = state.lastFinishAt ? new Date(state.lastFinishAt).getTime() : 0
    const softDue = lastRun + state.schedulePolicy.softIntervalMs
    candidates.push(Math.max(softDue, nowMs))
  }

  // Next hard due time
  if (!state.paused && !state.lockLease && !state.currentRun) {
    const lastRun = state.lastFinishAt ? new Date(state.lastFinishAt).getTime() : 0
    const hardDue = lastRun + state.schedulePolicy.hardIntervalMs
    candidates.push(hardDue)
  }

  const validCandidates = candidates.filter((t) => t > nowMs)
  if (validCandidates.length === 0) {
    return undefined
  }

  const nextWake = Math.min(...validCandidates)
  return new Date(nextWake).toISOString()
}

/**
 * Check if automation can dispatch a new task.
 */
function canDispatch(state: InstanceState, nowMs: number): { can: boolean; reason?: string } {
  if (state.paused) {
    return { can: false, reason: 'paused' }
  }

  if (state.lockLease) {
    const expiresAt = new Date(state.lockLease.expiresAt).getTime()
    if (expiresAt > nowMs) {
      return { can: false, reason: 'locked' }
    }
  }

  if (state.cooldownUntil) {
    const cooldownEnd = new Date(state.cooldownUntil).getTime()
    if (cooldownEnd > nowMs) {
      return { can: false, reason: 'cooldown' }
    }
  }

  if (state.currentRun) {
    return { can: false, reason: 'run_in_progress' }
  }

  return { can: true }
}

/**
 * Check if a run is due (soft or hard).
 */
function isRunDue(
  state: InstanceState,
  nowMs: number,
): { due: boolean; reason?: 'soft_due' | 'hard_due' } {
  const lastRun = state.lastFinishAt ? new Date(state.lastFinishAt).getTime() : 0

  // Hard due check first
  const hardDue = lastRun + state.schedulePolicy.hardIntervalMs
  if (nowMs >= hardDue) {
    return { due: true, reason: 'hard_due' }
  }

  // Soft due check
  const softDue = lastRun + state.schedulePolicy.softIntervalMs
  if (nowMs >= softDue) {
    return { due: true, reason: 'soft_due' }
  }

  return { due: false }
}

/**
 * Apply a command to state and return new state + events.
 * This is a pure function with no side effects.
 */
export function reconcile(state: InstanceState, command: Command): ReconcileResult {
  const events: DomainEvent[] = []
  let newState = { ...state }
  const nowMs = new Date(command.now).getTime()

  // Check for expired lock lease first (applies to all commands)
  if (newState.lockLease) {
    const expiresAt = new Date(newState.lockLease.expiresAt).getTime()
    if (nowMs >= expiresAt) {
      newState = { ...newState, lockLease: undefined }
      events.push({ type: 'LockExpired' })
    }
  }

  // Check for expired cooldown
  if (newState.cooldownUntil) {
    const cooldownEnd = new Date(newState.cooldownUntil).getTime()
    if (nowMs >= cooldownEnd) {
      newState = { ...newState, cooldownUntil: undefined }
      events.push({ type: 'CooldownExpired' })
    }
  }

  // Check for expired dispatch lease
  if (newState.currentRun?.dispatchLeaseExpiresAt) {
    const leaseEnd = new Date(newState.currentRun.dispatchLeaseExpiresAt).getTime()
    if (nowMs >= leaseEnd && newState.currentRun.state === 'DISPATCHED') {
      const runId = newState.currentRun.runId
      newState = {
        ...newState,
        currentRun: undefined,
        lastFinishAt: command.now,
      }
      events.push({ type: 'TaskLost', runId, reason: 'dispatch_lease_expired' })
    }
  }

  switch (command.type) {
    case 'PhoneLock': {
      // If there's an active run, abort it
      if (newState.currentRun) {
        const runId = newState.currentRun.runId
        newState = {
          ...newState,
          currentRun: { ...newState.currentRun, state: 'ABORTING', abortRequestedAt: command.now },
        }
        events.push({ type: 'TaskAborted', runId, reason: 'lock_acquired' })
      }

      const expiresAt = new Date(nowMs + newState.schedulePolicy.lockLeaseMs).toISOString()

      // Check if this is a renewal (same source, not expired)
      if (newState.lockLease && newState.lockLease.source === 'phone') {
        const newLease: LockLease = {
          ...newState.lockLease,
          expiresAt,
        }
        newState = { ...newState, lockLease: newLease }
        events.push({ type: 'LockRenewed', expiresAt })
      } else {
        const newLease: LockLease = {
          revision: command.revision,
          source: 'phone',
          acquiredAt: command.now,
          expiresAt,
        }
        newState = { ...newState, lockLease: newLease }
        events.push({ type: 'LockAcquired', source: 'phone', expiresAt })
      }
      break
    }

    case 'PhoneUnlock': {
      if (newState.lockLease?.source === 'phone') {
        const cooldownUntil = new Date(
          nowMs + newState.schedulePolicy.postUnlockDelayMs,
        ).toISOString()
        newState = {
          ...newState,
          lockLease: undefined,
          cooldownUntil,
        }
        events.push({ type: 'UnlockCooldownStarted', cooldownUntil })
      }
      break
    }

    case 'RunNow': {
      const dispatch = canDispatch(newState, nowMs)
      if (!dispatch.can) {
        break
      }

      // Check skip-if-next-run-within rule
      const lastRun = newState.lastFinishAt ? new Date(newState.lastFinishAt).getTime() : 0
      const softDue = lastRun + newState.schedulePolicy.softIntervalMs
      const timeUntilNext = softDue - nowMs

      if (timeUntilNext > 0 && timeUntilNext < newState.schedulePolicy.skipIfNextRunWithinMs) {
        events.push({ type: 'RunSkipped', reason: 'next_run_within_window' })
        break
      }

      const runId = generateRunId()
      const maaTaskId = generateMaaTaskId()
      const dispatchLeaseExpiresAt = new Date(nowMs + 30 * 60 * 1000).toISOString() // 30 min dispatch lease

      const newRun: CurrentRun = {
        runId,
        maaTaskId,
        generation: (newState.currentRun?.generation ?? 0) + 1,
        state: 'PENDING_DISPATCH',
        dispatchLeaseExpiresAt,
      }

      newState = { ...newState, currentRun: newRun }
      events.push({ type: 'RunScheduled', runId, reason: 'manual' })
      break
    }

    case 'AbortRun': {
      if (newState.currentRun && newState.currentRun.state !== 'ABORTING') {
        const runId = newState.currentRun.runId
        newState = {
          ...newState,
          currentRun: { ...newState.currentRun, state: 'ABORTING', abortRequestedAt: command.now },
        }
        events.push({ type: 'TaskAborted', runId, reason: 'manual' })
      }
      break
    }

    case 'ReleaseLockLease': {
      if (newState.lockLease) {
        newState = { ...newState, lockLease: undefined }
        events.push({ type: 'LockReleased', actor: command.actor })
      }
      break
    }

    case 'PauseAutomation': {
      if (!newState.paused) {
        newState = { ...newState, paused: true, pauseReason: command.reason }
        events.push({ type: 'AutomationPaused', actor: command.actor, reason: command.reason })
      }
      break
    }

    case 'ResumeAutomation': {
      if (newState.paused) {
        newState = { ...newState, paused: false, pauseReason: undefined }
        events.push({ type: 'AutomationResumed', actor: command.actor })
      }
      break
    }

    case 'SetSchedulePolicy': {
      newState = {
        ...newState,
        schedulePolicy: { ...newState.schedulePolicy, ...command.patch },
      }
      events.push({
        type: 'SchedulePolicyUpdated',
        actor: command.actor,
        patch: command.patch as Record<string, number>,
      })
      break
    }

    case 'PatchTaskTemplate': {
      newState = {
        ...newState,
        taskTemplate: { ...newState.taskTemplate, ...command.patch },
      }
      events.push({
        type: 'TaskTemplateUpdated',
        actor: command.actor,
        patch: command.patch as Record<string, string | undefined>,
      })
      break
    }

    case 'MaaGetTask': {
      const dispatch = canDispatch(newState, nowMs)

      // If we have a pending dispatch, transition to dispatched
      if (newState.currentRun?.state === 'PENDING_DISPATCH') {
        const currentRun = newState.currentRun
        newState = {
          ...newState,
          currentRun: {
            ...currentRun,
            state: 'DISPATCHED',
            dispatchedAt: command.now,
          },
        }
        events.push({
          type: 'TaskDispatched',
          runId: currentRun.runId,
          maaTaskId: currentRun.maaTaskId,
        })
        break
      }

      // Check if we should schedule a new run
      if (dispatch.can) {
        const dueCheck = isRunDue(newState, nowMs)
        if (dueCheck.due && dueCheck.reason) {
          const runId = generateRunId()
          const maaTaskId = generateMaaTaskId()
          const dispatchLeaseExpiresAt = new Date(nowMs + 30 * 60 * 1000).toISOString()

          const newRun: CurrentRun = {
            runId,
            maaTaskId,
            generation: (newState.currentRun?.generation ?? 0) + 1,
            state: 'DISPATCHED',
            dispatchedAt: command.now,
            dispatchLeaseExpiresAt,
          }

          newState = { ...newState, currentRun: newRun }
          events.push({ type: 'RunScheduled', runId, reason: dueCheck.reason })
          events.push({ type: 'TaskDispatched', runId, maaTaskId })
        }
      }
      break
    }

    case 'MaaReportStatus': {
      // Verify this report is for the current run
      if (!newState.currentRun || newState.currentRun.maaTaskId !== command.maaTaskId) {
        // Stale or duplicate report, ignore
        break
      }

      const runId = newState.currentRun.runId
      const isSuccess = command.status === 'SUCCESS'

      newState = {
        ...newState,
        currentRun: undefined,
        lastFinishAt: command.now,
        lastSuccessAt: isSuccess ? command.now : newState.lastSuccessAt,
      }

      events.push({
        type: 'TaskCompleted',
        runId,
        status: isSuccess ? 'DONE' : 'FAILED',
        payload: command.payload,
      })
      break
    }

    case 'MaaDeviceLog': {
      // Just emit event, actual log storage is handled by DO
      const lineCount = command.text.split('\n').filter((l) => l.trim()).length
      events.push({ type: 'LogIngested', lineCount })
      break
    }

    case 'AlarmFired': {
      // Alarm is just a wake-up, state cleanup already happened above
      // Check if we should trigger a scheduled run
      const dispatch = canDispatch(newState, nowMs)
      const currentGeneration = newState.currentRun?.generation ?? 0
      if (dispatch.can && !newState.currentRun) {
        const dueCheck = isRunDue(newState, nowMs)
        if (dueCheck.due && dueCheck.reason) {
          const runId = generateRunId()
          const maaTaskId = generateMaaTaskId()
          const dispatchLeaseExpiresAt = new Date(nowMs + 30 * 60 * 1000).toISOString()

          const newRun: CurrentRun = {
            runId,
            maaTaskId,
            generation: currentGeneration + 1,
            state: 'PENDING_DISPATCH',
            dispatchLeaseExpiresAt,
          }

          newState = { ...newState, currentRun: newRun }
          events.push({ type: 'RunScheduled', runId, reason: dueCheck.reason })
        }
      }
      break
    }
  }

  // Update version and nextWakeAt
  newState = {
    ...newState,
    version: newState.version + 1,
    nextWakeAt: calculateNextWake(newState, nowMs),
  }

  return { state: newState, events }
}

// Re-export types for convenience
export type { Command } from './commands'
export type { DomainEvent } from './events'
