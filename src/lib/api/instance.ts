import { createORPCClient } from '@orpc/client'
import { RPCLink } from '@orpc/client/fetch'
import type { RouterClient } from '@orpc/server'
import { createRouterUtils } from '@orpc/tanstack-query'

import type { DashboardRouter } from '#shared/rpc/dashboard'
export type {
  CommandResult as CommandResponse,
  ConfigRevisionRecord as ConfigRevision,
  EventRecord as EventHistoryItem,
  LogRecord as LogEntry,
  RunRecord as RunHistoryItem,
} from '#shared/rpc/dashboard'
export type { InstanceState as InstanceStateResponse } from '#shared/domain/state'

function createRpcUrl(): URL | string {
  if (typeof window === 'undefined') {
    return 'http://localhost/rpc'
  }

  return new URL('/rpc', window.location.origin)
}

const link = new RPCLink({
  url: createRpcUrl(),
})

const client: RouterClient<DashboardRouter> = createORPCClient(link)

export const instanceRpc = createRouterUtils(client)
