import type { InstanceState } from '../shared/domain/state'
import type { MaaDeviceLogResponse, MaaGetTaskResponse } from '../shared/protocol/maa'
import type {
  CommandResult,
  ConfigRevisionRecord,
  DashboardInstanceApi,
  EventRecord,
  LogRecord,
  RunRecord,
} from '../shared/rpc/dashboard'
import type { Env } from './env'

const DO_ORIGIN = 'http://instance'

function getInstanceStub(env: Env, instanceId: string): DurableObjectStub {
  const id = env.INSTANCE_DO.idFromName(instanceId)
  return env.INSTANCE_DO.get(id)
}

function toInstanceId(user: string, device: string): string {
  return `${user}:${device}`
}

async function readJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    throw new Error(await response.text())
  }

  return response.json() as Promise<T>
}

async function readText(response: Response): Promise<string> {
  if (!response.ok) {
    throw new Error(await response.text())
  }

  return response.text()
}

async function fetchDo(
  env: Env,
  instanceId: string,
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const headers = new Headers(init.headers)
  headers.set('X-Instance-Id', instanceId)

  return getInstanceStub(env, instanceId).fetch(
    new Request(`${DO_ORIGIN}${path}`, {
      ...init,
      headers,
    }),
  )
}

async function fetchDoJson<T>(
  env: Env,
  instanceId: string,
  path: string,
  init: RequestInit = {},
): Promise<T> {
  return readJson<T>(await fetchDo(env, instanceId, path, init))
}

async function fetchDoText(
  env: Env,
  instanceId: string,
  path: string,
  init: RequestInit = {},
): Promise<string> {
  return readText(await fetchDo(env, instanceId, path, init))
}

async function applyCommand(
  env: Env,
  instanceId: string,
  command: string,
  body: Record<string, unknown>,
  actor: string,
): Promise<CommandResult> {
  const result = await fetchDoJson<{ state: InstanceState }>(
    env,
    instanceId,
    `/api/commands/${command}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Actor': actor,
      },
      body: JSON.stringify(body),
    },
  )

  return { state: result.state }
}

export interface MaaInstanceApi {
  deviceLog(user: string, device: string, text: string): Promise<MaaDeviceLogResponse>
  getTask(user: string, device: string): Promise<MaaGetTaskResponse>
  reportStatus(
    user: string,
    device: string,
    task: string,
    status?: string,
    payload?: string,
  ): Promise<string>
}

export interface InstanceApi extends DashboardInstanceApi, MaaInstanceApi {}

export function createInstanceApi(env: Env): InstanceApi {
  return {
    abortRun(instanceId, actor) {
      return applyCommand(env, instanceId, 'abort-run', {}, actor)
    },

    async deviceLog(user, device, text) {
      return fetchDoJson<MaaDeviceLogResponse>(env, toInstanceId(user, device), '/maa/deviceLog', {
        method: 'POST',
        body: text,
      })
    },

    getConfig(instanceId) {
      return fetchDoJson<ConfigRevisionRecord[]>(env, instanceId, '/api/config')
    },

    getEvents(instanceId) {
      return fetchDoJson<EventRecord[]>(env, instanceId, '/api/events')
    },

    async getLogs(instanceId) {
      return fetchDoJson<LogRecord[]>(env, instanceId, '/api/logs')
    },

    async getRuns(instanceId) {
      return fetchDoJson<RunRecord[]>(env, instanceId, '/api/runs')
    },

    async getState(instanceId) {
      return fetchDoJson<InstanceState>(env, instanceId, '/api/state')
    },

    async getTask(user, device) {
      return fetchDoJson<MaaGetTaskResponse>(env, toInstanceId(user, device), '/maa/getTask', {
        method: 'POST',
      })
    },

    patchTaskTemplate(instanceId, actor, patch) {
      return applyCommand(env, instanceId, 'patch-task-template', { template: patch }, actor)
    },

    pause(instanceId, actor, reason) {
      return applyCommand(env, instanceId, 'pause', { reason }, actor)
    },

    phoneLock(instanceId, revision) {
      return applyCommand(env, instanceId, 'phone-lock', { revision }, 'phone')
    },

    phoneUnlock(instanceId, revision) {
      return applyCommand(env, instanceId, 'phone-unlock', { revision }, 'phone')
    },

    releaseLockLease(instanceId, actor) {
      return applyCommand(env, instanceId, 'release-lock-lease', {}, actor)
    },

    async reportStatus(user, device, task, status, payload) {
      return fetchDoText(env, toInstanceId(user, device), '/maa/reportStatus', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          payload,
          status,
          task,
        }),
      })
    },

    resume(instanceId, actor) {
      return applyCommand(env, instanceId, 'resume', {}, actor)
    },

    runNow(instanceId, actor) {
      return applyCommand(env, instanceId, 'run-now', {}, actor)
    },

    setSchedulePolicy(instanceId, actor, patch) {
      return applyCommand(env, instanceId, 'set-schedule-policy', { policy: patch }, actor)
    },
  }
}
