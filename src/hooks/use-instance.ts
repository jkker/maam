import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import {
  type ConfigRevision,
  type EventHistoryItem,
  type InstanceStateResponse,
  instanceRpc,
  type LogEntry,
  type RunHistoryItem,
} from '#/lib/api/instance'
import type { InstanceState } from '#shared/domain/state'

export const instanceKeys = {
  all: ['instances'] as const,
  config: (id: string) => instanceRpc.instances.config.queryKey({ input: { instanceId: id } }),
  events: (id: string) => instanceRpc.instances.events.queryKey({ input: { instanceId: id } }),
  logs: (id: string) => instanceRpc.instances.logs.queryKey({ input: { instanceId: id } }),
  runs: (id: string) => instanceRpc.instances.runs.queryKey({ input: { instanceId: id } }),
  state: (id: string) => instanceRpc.instances.state.queryKey({ input: { instanceId: id } }),
}

export function useInstanceState(instanceId: string) {
  return useQuery<InstanceStateResponse>(
    instanceRpc.instances.state.queryOptions({
      input: { instanceId },
      refetchInterval: 5000,
    }),
  )
}

export function useInstanceRuns(instanceId: string) {
  return useQuery<RunHistoryItem[]>(
    instanceRpc.instances.runs.queryOptions({
      input: { instanceId },
      refetchInterval: 10000,
    }),
  )
}

export function useInstanceEvents(instanceId: string) {
  return useQuery<EventHistoryItem[]>(
    instanceRpc.instances.events.queryOptions({
      input: { instanceId },
      refetchInterval: 10000,
    }),
  )
}

export function useInstanceLogs(instanceId: string) {
  return useQuery<LogEntry[]>(
    instanceRpc.instances.logs.queryOptions({
      input: { instanceId },
      refetchInterval: 5000,
    }),
  )
}

export function useInstanceConfig(instanceId: string) {
  return useQuery<ConfigRevision[]>(
    instanceRpc.instances.config.queryOptions({
      input: { instanceId },
    }),
  )
}

function invalidateInstanceQueries(
  queryClient: ReturnType<typeof useQueryClient>,
  instanceId: string,
) {
  void queryClient.invalidateQueries({ queryKey: instanceKeys.state(instanceId) })
  void queryClient.invalidateQueries({ queryKey: instanceKeys.runs(instanceId) })
  void queryClient.invalidateQueries({ queryKey: instanceKeys.events(instanceId) })
  void queryClient.invalidateQueries({ queryKey: instanceKeys.logs(instanceId) })
  void queryClient.invalidateQueries({ queryKey: instanceKeys.config(instanceId) })
}

export function useRunNow(instanceId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: () => instanceRpc.instances.runNow.call({ instanceId }),
    onSuccess: () => {
      invalidateInstanceQueries(queryClient, instanceId)
    },
  })
}

export function useAbortRun(instanceId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: () => instanceRpc.instances.abortRun.call({ instanceId }),
    onSuccess: () => {
      invalidateInstanceQueries(queryClient, instanceId)
    },
  })
}

export function useReleaseLockLease(instanceId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: () => instanceRpc.instances.releaseLockLease.call({ instanceId }),
    onSuccess: () => {
      invalidateInstanceQueries(queryClient, instanceId)
    },
  })
}

export function usePauseAutomation(instanceId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (reason?: string) => instanceRpc.instances.pause.call({ instanceId, reason }),
    onSuccess: () => {
      invalidateInstanceQueries(queryClient, instanceId)
    },
  })
}

export function useResumeAutomation(instanceId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: () => instanceRpc.instances.resume.call({ instanceId }),
    onSuccess: () => {
      invalidateInstanceQueries(queryClient, instanceId)
    },
  })
}

export function useSetSchedulePolicy(instanceId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (patch: Partial<InstanceState['schedulePolicy']>) =>
      instanceRpc.instances.setSchedulePolicy.call({ instanceId, patch }),
    onSuccess: () => {
      invalidateInstanceQueries(queryClient, instanceId)
    },
  })
}

export function usePatchTaskTemplate(instanceId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (patch: Partial<InstanceState['taskTemplate']>) =>
      instanceRpc.instances.patchTaskTemplate.call({ instanceId, patch }),
    onSuccess: () => {
      invalidateInstanceQueries(queryClient, instanceId)
    },
  })
}

export function usePhoneLock(instanceId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (revision?: number) =>
      instanceRpc.instances.phoneLock.call({ instanceId, revision }),
    onSuccess: () => {
      invalidateInstanceQueries(queryClient, instanceId)
    },
  })
}

export function usePhoneUnlock(instanceId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (revision?: number) =>
      instanceRpc.instances.phoneUnlock.call({ instanceId, revision }),
    onSuccess: () => {
      invalidateInstanceQueries(queryClient, instanceId)
    },
  })
}
