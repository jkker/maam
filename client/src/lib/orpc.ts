import type { RouterClient, router } from '@maam/server'

import { createORPCClient } from '@orpc/client'
import { RPCLink } from '@orpc/client/fetch'
import { createRouterUtils } from '@orpc/tanstack-query'
import { QueryClient } from '@tanstack/react-query'

import { useAuthStore } from './auth-store'

const url = '/rpc'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Disable all queries by default until authenticated
      enabled: false,
      retry: false,
    },
  },
})

/**
 * Create oRPC link with auth via HTTP headers (OpenAPI 3.x compliant)
 * Uses x-maam-user and x-maam-device headers for authentication
 */
const link = new RPCLink({
  url,
  /**
   * Headers callback to inject auth from zustand store
   * This follows OpenAPI 3.x best practices for custom auth headers
   */
  headers: () => {
    const { user, device } = useAuthStore.getState()
    
    // Only add headers if authenticated
    if (!user || !device) {
      return {}
    }

    return {
      'x-maam-user': user,
      'x-maam-device': device,
    }
  },
})

/**
 * Create oRPC client with proper type inference from router
 */
export const orpcClient: RouterClient<typeof router> = createORPCClient(link)

/**
 * Create Tanstack Query utilities with proper type inference
 */
export const orpc = createRouterUtils(orpcClient)

export const invalidateQueries = queryClient.invalidateQueries.bind(queryClient)
