import { os } from '@orpc/server'
import { type } from 'arktype'

import type { DomainEvent } from '../domain/events'
import type { InstanceState, RunFinalStatus, RunState } from '../domain/state'

export interface RunRecord {
  run_id: string
  maa_task_id: string
  generation: number
  state: RunState | RunFinalStatus
  created_at: string
  dispatched_at: string | null
  finished_at: string | null
  status: 'SUCCESS' | 'FAILED' | 'ABORTED' | 'LOST' | null
  payload: string | null
}

export interface EventRecord {
  seq: number
  at: string
  type: DomainEvent['type']
  data: DomainEvent
}

export interface LogRecord {
  seq: number
  at: string
  text: string
}

export interface ConfigRevisionRecord {
  seq: number
  at: string
  actor: string
  data: unknown
}

export interface CommandResult {
  state: InstanceState
}

export interface DashboardInstanceApi {
  abortRun(instanceId: string, actor: string): Promise<CommandResult>
  getConfig(instanceId: string): Promise<ConfigRevisionRecord[]>
  getEvents(instanceId: string): Promise<EventRecord[]>
  getLogs(instanceId: string): Promise<LogRecord[]>
  getRuns(instanceId: string): Promise<RunRecord[]>
  getState(instanceId: string): Promise<InstanceState>
  patchTaskTemplate(
    instanceId: string,
    actor: string,
    patch: Partial<InstanceState['taskTemplate']>,
  ): Promise<CommandResult>
  pause(instanceId: string, actor: string, reason?: string): Promise<CommandResult>
  phoneLock(instanceId: string, revision?: number): Promise<CommandResult>
  phoneUnlock(instanceId: string, revision?: number): Promise<CommandResult>
  releaseLockLease(instanceId: string, actor: string): Promise<CommandResult>
  resume(instanceId: string, actor: string): Promise<CommandResult>
  runNow(instanceId: string, actor: string): Promise<CommandResult>
  setSchedulePolicy(
    instanceId: string,
    actor: string,
    patch: Partial<InstanceState['schedulePolicy']>,
  ): Promise<CommandResult>
}

interface DashboardContext {
  actor: string
  api: DashboardInstanceApi
}

const base = os.$context<DashboardContext>()

const InstanceIdInput = type({
  instanceId: 'string',
})

const PauseInput = type({
  instanceId: 'string',
  'reason?': 'string',
})

const LockRevisionInput = type({
  instanceId: 'string',
  'revision?': 'number.integer',
})

const SchedulePolicyPatchInput = type({
  instanceId: 'string',
  patch: {
    'softIntervalMs?': 'number.integer >= 0',
    'hardIntervalMs?': 'number.integer >= 0',
    'postUnlockDelayMs?': 'number.integer >= 0',
    'lockLeaseMs?': 'number.integer >= 0',
    'skipIfNextRunWithinMs?': 'number.integer >= 0',
  },
})

const TaskTemplatePatchInput = type({
  instanceId: 'string',
  patch: {
    'maaTaskType?': 'string',
    'params?': 'string',
  },
})

/**
 * Shared oRPC dashboard router.
 *
 * The handler body is intentionally thin: all stateful work stays in the
 * injected instance API so the HTTP surface and client types share one source
 * of truth.
 */
export function createDashboardRouter() {
  return {
    instances: {
      abortRun: base
        .input(InstanceIdInput)
        .handler(({ context, input }) => context.api.abortRun(input.instanceId, context.actor)),

      config: base
        .input(InstanceIdInput)
        .handler(({ context, input }) => context.api.getConfig(input.instanceId)),

      events: base
        .input(InstanceIdInput)
        .handler(({ context, input }) => context.api.getEvents(input.instanceId)),

      logs: base
        .input(InstanceIdInput)
        .handler(({ context, input }) => context.api.getLogs(input.instanceId)),

      patchTaskTemplate: base
        .input(TaskTemplatePatchInput)
        .handler(({ context, input }) =>
          context.api.patchTaskTemplate(input.instanceId, context.actor, input.patch),
        ),

      pause: base
        .input(PauseInput)
        .handler(({ context, input }) =>
          context.api.pause(input.instanceId, context.actor, input.reason),
        ),

      phoneLock: base
        .input(LockRevisionInput)
        .handler(({ context, input }) => context.api.phoneLock(input.instanceId, input.revision)),

      phoneUnlock: base
        .input(LockRevisionInput)
        .handler(({ context, input }) => context.api.phoneUnlock(input.instanceId, input.revision)),

      releaseLockLease: base
        .input(InstanceIdInput)
        .handler(({ context, input }) =>
          context.api.releaseLockLease(input.instanceId, context.actor),
        ),

      resume: base
        .input(InstanceIdInput)
        .handler(({ context, input }) => context.api.resume(input.instanceId, context.actor)),

      runNow: base
        .input(InstanceIdInput)
        .handler(({ context, input }) => context.api.runNow(input.instanceId, context.actor)),

      runs: base
        .input(InstanceIdInput)
        .handler(({ context, input }) => context.api.getRuns(input.instanceId)),

      setSchedulePolicy: base
        .input(SchedulePolicyPatchInput)
        .handler(({ context, input }) =>
          context.api.setSchedulePolicy(input.instanceId, context.actor, input.patch),
        ),

      state: base
        .input(InstanceIdInput)
        .handler(({ context, input }) => context.api.getState(input.instanceId)),
    },
  }
}

export type DashboardRouter = ReturnType<typeof createDashboardRouter>
