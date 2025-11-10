import type { RouterClient, router } from '@maam/server'

import { createORPCClient } from '@orpc/client'
import { RPCLink } from '@orpc/client/fetch'
import { createRouterUtils } from '@orpc/tanstack-query'
import { QueryClient } from '@tanstack/react-query'

import { useAuthStore } from './auth-store'

const url = '/rpc'

export const queryClient = new QueryClient()

/**
 * Create oRPC link with auth query params from zustand store
 */
const link = new RPCLink({
  url,
  fetch: async (input: RequestInfo | URL, init?: RequestInit) => {
    // Get auth from zustand store
    const { user, device } = useAuthStore.getState()

    if (!user || !device) {
      return fetch(input, init)
    }

    // Add auth params to URL query string
    const params = new URLSearchParams({ user, device })
    const paramString = params.toString()

    let finalUrl: string
    if (typeof input === 'string') {
      finalUrl = paramString ? `${input}${input.includes('?') ? '&' : '?'}${paramString}` : input
    } else if (input instanceof URL) {
      const url = new URL(input)
      url.searchParams.set('user', user)
      url.searchParams.set('device', device)
      finalUrl = url.toString()
    } else {
      // Request object
      const url = new URL(input.url)
      url.searchParams.set('user', user)
      url.searchParams.set('device', device)
      finalUrl = url.toString()
    }

    return fetch(finalUrl, init)
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
