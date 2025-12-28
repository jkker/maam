import type { ORPC } from '@maam/server'

import { createORPCClient } from '@orpc/client'
import { RPCLink } from '@orpc/client/fetch'
import { createRouterUtils } from '@orpc/tanstack-query'
import { QueryClient } from '@tanstack/react-query'

import { useAuthStore } from './auth-store'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Disable all queries by default until authenticated
      enabled: false,
      retry: false,
    },
  },
})

export const invalidateQueries = queryClient.invalidateQueries.bind(queryClient)

/**
 * Reactive hook for oRPC that updates when auth state changes
 * Returns the orpc instance which will automatically use current auth from headers callback
 *
 * Note: To enable/disable queries based on auth, manually pass enabled option:
 * useQuery(orpc.someQuery.queryOptions({ input, enabled: isAuthenticated }))
 */
export function useRPC() {
  const { user, device, isAuthenticated } = useAuthStore()
  const link = new RPCLink({
    url: new URL('/rpc', window.location.origin),
    headers: {
      'x-maam-user': user,
      'x-maam-device': device,
    },
  })
  const screenshotURL = `/maa/screenshot.mjpeg?user=${user}&device=${device}`

  const client: ORPC = createORPCClient(link)
  const orpc = createRouterUtils(client)
  return { orpc, isAuthenticated, screenshotURL }
}
