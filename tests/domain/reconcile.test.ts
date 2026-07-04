import { describe, expect, it } from 'vite-plus/test'

import { createFakeClock } from '#shared/domain/clock'
import { reconcile } from '#shared/domain/reconcile'
import { createInitialState, DEFAULT_SCHEDULE_POLICY } from '#shared/domain/state'

// Time constants (virtual milliseconds)
const HOUR = 60 * 60 * 1000
const MINUTE = 60 * 1000

describe('reconcile - lock management', () => {
  it('lock blocks dispatch immediately', () => {
    const clock = createFakeClock(0)
    let state = createInitialState('test:device')

    // Apply phone lock
    const result = reconcile(state, { type: 'PhoneLock', now: clock.nowIso() })

    expect(result.state.lockLease).toBeDefined()
    expect(result.state.lockLease?.source).toBe('phone')
    expect(result.events).toContainEqual(
      expect.objectContaining({ type: 'LockAcquired', source: 'phone' }),
    )

    // Try to dispatch via MaaGetTask
    state = result.state
    const getTaskResult = reconcile(state, { type: 'MaaGetTask', now: clock.nowIso() })

    // Should not dispatch any task
    expect(getTaskResult.state.currentRun).toBeUndefined()
  })

  it('repeated lock renews lease', () => {
    const clock = createFakeClock(0)
    let state = createInitialState('test:device')

    // First lock
    let result = reconcile(state, { type: 'PhoneLock', now: clock.nowIso() })
    const firstExpiresAt = result.state.lockLease?.expiresAt

    // Advance 1 hour
    clock.advanceVirtual(HOUR)
    state = result.state

    // Second lock (renewal)
    result = reconcile(state, { type: 'PhoneLock', now: clock.nowIso() })
    const secondExpiresAt = result.state.lockLease?.expiresAt

    expect(result.events).toContainEqual(expect.objectContaining({ type: 'LockRenewed' }))
    expect(new Date(secondExpiresAt!).getTime()).toBeGreaterThan(
      new Date(firstExpiresAt!).getTime(),
    )
  })

  it('stale lock lease expires automatically', () => {
    const clock = createFakeClock(0)
    let state = createInitialState('test:device')

    // Apply lock
    let result = reconcile(state, { type: 'PhoneLock', now: clock.nowIso() })
    expect(result.state.lockLease).toBeDefined()

    // Advance past lock lease duration (4 hours default)
    clock.advanceVirtual(DEFAULT_SCHEDULE_POLICY.lockLeaseMs + MINUTE)
    state = result.state

    // Any command should trigger expiry check
    result = reconcile(state, { type: 'MaaGetTask', now: clock.nowIso() })

    expect(result.state.lockLease).toBeUndefined()
    expect(result.events).toContainEqual({ type: 'LockExpired' })
  })

  it('manual release lock lease unblocks scheduling', () => {
    const clock = createFakeClock(0)
    let state = createInitialState('test:device')

    // Apply lock
    let result = reconcile(state, { type: 'PhoneLock', now: clock.nowIso() })
    expect(result.state.lockLease).toBeDefined()
    state = result.state

    // Release lock
    result = reconcile(state, { type: 'ReleaseLockLease', actor: 'admin', now: clock.nowIso() })

    expect(result.state.lockLease).toBeUndefined()
    expect(result.events).toContainEqual(
      expect.objectContaining({ type: 'LockReleased', actor: 'admin' }),
    )
  })
})

describe('reconcile - unlock cooldown', () => {
  it('unlock creates 30m cooldown', () => {
    const clock = createFakeClock(0)
    let state = createInitialState('test:device')

    // Lock then unlock
    let result = reconcile(state, { type: 'PhoneLock', now: clock.nowIso() })
    state = result.state

    result = reconcile(state, { type: 'PhoneUnlock', now: clock.nowIso() })

    expect(result.state.lockLease).toBeUndefined()
    expect(result.state.cooldownUntil).toBeDefined()
    expect(result.events).toContainEqual(expect.objectContaining({ type: 'UnlockCooldownStarted' }))

    // Cooldown should be ~30 minutes from now
    const cooldownEnd = new Date(result.state.cooldownUntil!).getTime()
    expect(cooldownEnd).toBe(clock.now() + DEFAULT_SCHEDULE_POLICY.postUnlockDelayMs)
  })

  it('cooldown blocks dispatch until expiry', () => {
    const clock = createFakeClock(0)
    let state = createInitialState('test:device')
    state = { ...state, lastFinishAt: new Date(clock.now() - 10 * HOUR).toISOString() } // Make run due

    // Lock then unlock to create cooldown
    let result = reconcile(state, { type: 'PhoneLock', now: clock.nowIso() })
    state = result.state
    result = reconcile(state, { type: 'PhoneUnlock', now: clock.nowIso() })
    state = result.state

    // Try to get task - should be blocked
    result = reconcile(state, { type: 'MaaGetTask', now: clock.nowIso() })
    expect(result.state.currentRun).toBeUndefined()

    // Advance past cooldown
    clock.advanceVirtual(DEFAULT_SCHEDULE_POLICY.postUnlockDelayMs + MINUTE)
    result = reconcile(state, { type: 'MaaGetTask', now: clock.nowIso() })

    expect(result.events).toContainEqual({ type: 'CooldownExpired' })
    expect(result.state.currentRun).toBeDefined()
  })
})

describe('reconcile - scheduling cadence', () => {
  it('soft run becomes due at 8h', () => {
    const clock = createFakeClock(0)
    let state = createInitialState('test:device')
    state = { ...state, lastFinishAt: clock.nowIso() }

    // Advance just under 8 hours
    clock.advanceVirtual(DEFAULT_SCHEDULE_POLICY.softIntervalMs - MINUTE)
    let result = reconcile(state, { type: 'MaaGetTask', now: clock.nowIso() })
    expect(result.state.currentRun).toBeUndefined()

    // Advance past 8 hours
    clock.advanceVirtual(2 * MINUTE)
    result = reconcile(state, { type: 'MaaGetTask', now: clock.nowIso() })

    expect(result.state.currentRun).toBeDefined()
    expect(result.events).toContainEqual(
      expect.objectContaining({ type: 'RunScheduled', reason: 'soft_due' }),
    )
  })

  it('hard run becomes due at 16h', () => {
    const clock = createFakeClock(0)
    let state = createInitialState('test:device')
    state = { ...state, lastFinishAt: clock.nowIso() }

    // Advance to 16 hours
    clock.advanceVirtual(DEFAULT_SCHEDULE_POLICY.hardIntervalMs)

    const result = reconcile(state, { type: 'MaaGetTask', now: clock.nowIso() })

    expect(result.state.currentRun).toBeDefined()
    expect(result.events).toContainEqual(
      expect.objectContaining({ type: 'RunScheduled', reason: 'hard_due' }),
    )
  })

  it('skip-early-run rule when next run is within 1h', () => {
    const clock = createFakeClock(0)
    let state = createInitialState('test:device')

    // Set lastFinishAt so next soft run is in 30 minutes
    const timeUntilNextRun = 30 * MINUTE
    const lastFinish = clock.now() - DEFAULT_SCHEDULE_POLICY.softIntervalMs + timeUntilNextRun
    state = { ...state, lastFinishAt: new Date(lastFinish).toISOString() }

    // Try to run now - should be skipped
    const result = reconcile(state, { type: 'RunNow', actor: 'user', now: clock.nowIso() })

    expect(result.state.currentRun).toBeUndefined()
    expect(result.events).toContainEqual(
      expect.objectContaining({ type: 'RunSkipped', reason: 'next_run_within_window' }),
    )
  })
})

describe('reconcile - run lifecycle', () => {
  it('RunNow schedules a pending dispatch', () => {
    const clock = createFakeClock(0)
    let state = createInitialState('test:device')

    const result = reconcile(state, { type: 'RunNow', actor: 'user', now: clock.nowIso() })

    expect(result.state.currentRun).toBeDefined()
    expect(result.state.currentRun?.state).toBe('PENDING_DISPATCH')
    expect(result.events).toContainEqual(
      expect.objectContaining({ type: 'RunScheduled', reason: 'manual' }),
    )
  })

  it('MaaGetTask transitions PENDING_DISPATCH to DISPATCHED', () => {
    const clock = createFakeClock(0)
    let state = createInitialState('test:device')

    // Schedule run
    let result = reconcile(state, { type: 'RunNow', actor: 'user', now: clock.nowIso() })
    state = result.state
    expect(state.currentRun?.state).toBe('PENDING_DISPATCH')

    // Dispatch via getTask
    result = reconcile(state, { type: 'MaaGetTask', now: clock.nowIso() })

    expect(result.state.currentRun?.state).toBe('DISPATCHED')
    expect(result.events).toContainEqual(expect.objectContaining({ type: 'TaskDispatched' }))
  })

  it('reportStatus finalizes run and updates lastSuccessAt', () => {
    const clock = createFakeClock(0)
    let state = createInitialState('test:device')

    // Schedule and dispatch
    let result = reconcile(state, { type: 'RunNow', actor: 'user', now: clock.nowIso() })
    state = result.state
    result = reconcile(state, { type: 'MaaGetTask', now: clock.nowIso() })
    state = result.state

    const maaTaskId = state.currentRun!.maaTaskId

    // Report success
    result = reconcile(state, {
      type: 'MaaReportStatus',
      now: clock.nowIso(),
      maaTaskId,
      status: 'SUCCESS',
    })

    expect(result.state.currentRun).toBeUndefined()
    expect(result.state.lastSuccessAt).toBe(clock.nowIso())
    expect(result.state.lastFinishAt).toBe(clock.nowIso())
    expect(result.events).toContainEqual(
      expect.objectContaining({ type: 'TaskCompleted', status: 'DONE' }),
    )
  })

  it('duplicate or stale status report is ignored', () => {
    const clock = createFakeClock(0)
    let state = createInitialState('test:device')

    // Report for non-existent task
    const result = reconcile(state, {
      type: 'MaaReportStatus',
      now: clock.nowIso(),
      maaTaskId: 'fake-task-id',
      status: 'SUCCESS',
    })

    expect(result.events).toHaveLength(0)
    expect(result.state.lastSuccessAt).toBeUndefined()
  })

  it('lock during dispatched run issues abort and reschedules', () => {
    const clock = createFakeClock(0)
    let state = createInitialState('test:device')

    // Schedule and dispatch
    let result = reconcile(state, { type: 'RunNow', actor: 'user', now: clock.nowIso() })
    state = result.state
    result = reconcile(state, { type: 'MaaGetTask', now: clock.nowIso() })
    state = result.state
    expect(state.currentRun?.state).toBe('DISPATCHED')

    // Phone lock arrives
    result = reconcile(state, { type: 'PhoneLock', now: clock.nowIso() })

    expect(result.state.currentRun?.state).toBe('ABORTING')
    expect(result.events).toContainEqual(
      expect.objectContaining({ type: 'TaskAborted', reason: 'lock_acquired' }),
    )
    expect(result.events).toContainEqual(expect.objectContaining({ type: 'LockAcquired' }))
  })
})

describe('reconcile - pause/resume', () => {
  it('paused state blocks automation', () => {
    const clock = createFakeClock(0)
    let state = createInitialState('test:device')
    state = { ...state, lastFinishAt: new Date(clock.now() - 10 * HOUR).toISOString() } // Make run due

    // Pause automation
    let result = reconcile(state, {
      type: 'PauseAutomation',
      actor: 'admin',
      reason: 'maintenance',
      now: clock.nowIso(),
    })
    state = result.state

    expect(state.paused).toBe(true)
    expect(state.pauseReason).toBe('maintenance')

    // Try to get task - should be blocked
    result = reconcile(state, { type: 'MaaGetTask', now: clock.nowIso() })
    expect(result.state.currentRun).toBeUndefined()

    // Resume
    result = reconcile(state, { type: 'ResumeAutomation', actor: 'admin', now: clock.nowIso() })
    expect(result.state.paused).toBe(false)
    expect(result.state.pauseReason).toBeUndefined()
  })
})

describe('reconcile - alarm handling', () => {
  it('AlarmFired triggers scheduled run when due', () => {
    const clock = createFakeClock(0)
    let state = createInitialState('test:device')
    state = { ...state, lastFinishAt: clock.nowIso() }

    // Advance past soft interval
    clock.advanceVirtual(DEFAULT_SCHEDULE_POLICY.softIntervalMs + MINUTE)

    const result = reconcile(state, { type: 'AlarmFired', now: clock.nowIso() })

    expect(result.state.currentRun).toBeDefined()
    expect(result.state.currentRun?.state).toBe('PENDING_DISPATCH')
    expect(result.events).toContainEqual(
      expect.objectContaining({ type: 'RunScheduled', reason: 'soft_due' }),
    )
  })

  it('dispatch lease expiry marks task as LOST', () => {
    const clock = createFakeClock(0)
    let state = createInitialState('test:device')

    // Schedule and dispatch
    let result = reconcile(state, { type: 'RunNow', actor: 'user', now: clock.nowIso() })
    state = result.state
    result = reconcile(state, { type: 'MaaGetTask', now: clock.nowIso() })
    state = result.state

    const runId = state.currentRun!.runId

    // Advance past dispatch lease (30 minutes)
    clock.advanceVirtual(31 * MINUTE)

    result = reconcile(state, { type: 'AlarmFired', now: clock.nowIso() })

    expect(result.state.currentRun).toBeUndefined()
    expect(result.events).toContainEqual(
      expect.objectContaining({ type: 'TaskLost', runId, reason: 'dispatch_lease_expired' }),
    )
  })

  it('nextWakeAt is set to nearest boundary', () => {
    const clock = createFakeClock(0)
    let state = createInitialState('test:device')
    state = { ...state, lastFinishAt: clock.nowIso() }

    const result = reconcile(state, { type: 'MaaGetTask', now: clock.nowIso() })

    expect(result.state.nextWakeAt).toBeDefined()
    // Should be the soft interval (8h from now)
    const expectedWake = clock.now() + DEFAULT_SCHEDULE_POLICY.softIntervalMs
    expect(new Date(result.state.nextWakeAt!).getTime()).toBe(expectedWake)
  })
})

describe('reconcile - config updates', () => {
  it('SetSchedulePolicy updates policy', () => {
    const clock = createFakeClock(0)
    const state = createInitialState('test:device')

    const result = reconcile(state, {
      type: 'SetSchedulePolicy',
      actor: 'admin',
      patch: { softIntervalMs: 4 * HOUR },
      now: clock.nowIso(),
    })

    expect(result.state.schedulePolicy.softIntervalMs).toBe(4 * HOUR)
    expect(result.events).toContainEqual(
      expect.objectContaining({ type: 'SchedulePolicyUpdated', actor: 'admin' }),
    )
  })

  it('PatchTaskTemplate updates template', () => {
    const clock = createFakeClock(0)
    const state = createInitialState('test:device')

    const result = reconcile(state, {
      type: 'PatchTaskTemplate',
      actor: 'admin',
      patch: { maaTaskType: 'LinkStart-Recruiting' },
      now: clock.nowIso(),
    })

    expect(result.state.taskTemplate.maaTaskType).toBe('LinkStart-Recruiting')
    expect(result.events).toContainEqual(
      expect.objectContaining({ type: 'TaskTemplateUpdated', actor: 'admin' }),
    )
  })
})
