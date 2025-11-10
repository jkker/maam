import type { RouterClient, router } from '@maam/server'

import { createORPCClient } from '@orpc/client'
import { RPCLink } from '@orpc/client/fetch'
import { createRouterUtils } from '@orpc/tanstack-query'
import { QueryClient } from '@tanstack/react-query'

import { useAuthStore } from './auth-store'

const url = '/rpc'

export const queryClient = new QueryClient()

/**
 * Client context type for auth information
 */
interface ClientContext {
  user?: string
  device?: string
}

/**
 * Create oRPC link with auth injection via interceptor
 * Auth info is automatically read from zustand store and added to query params
 */
const link = new RPCLink<ClientContext>({
  url,
  /**
   * Interceptor to automatically inject auth from zustand store into context
   * This runs before every request
   */
  interceptors: [
    ({ next, context, path, input }) => {
      // Get current auth from store (using IIFE to bind properly)
      const authState = (() => useAuthStore.getState.bind(useAuthStore)())()

      // Inject auth into context for this request
      return next({
        context: {
          ...context,
          user: context.user || authState.user,
          device: context.device || authState.device,
        },
        path,
        input,
      })
    },
  ],
  /**
   * Custom fetch to add auth as URL query params
   */
  fetch: async (input, init, { context }) => {
    const user = context.user
    const device = context.device

    if (!user || !device) {
      return fetch(input, init)
    }

    // Add auth params to URL query string
    const params = new URLSearchParams({ user, device })
    const paramString = params.toString()

    let finalUrl: string | URL | Request
    if (typeof input === 'string') {
      const inputStr: string = input
      finalUrl = paramString
        ? `${inputStr}${inputStr.includes('?') ? '&' : '?'}${paramString}`
        : inputStr
    } else if (input instanceof URL) {
      const url = new URL(input)
      url.searchParams.set('user', user)
      url.searchParams.set('device', device)
      finalUrl = url
    } else {
      // Request object
      const url = new URL(input.url)
      url.searchParams.set('user', user)
      url.searchParams.set('device', device)
      finalUrl = url
    }

    return fetch(finalUrl, init)
  },
})

/**
 * Create oRPC client with proper type inference from router
 */
export const orpcClient: RouterClient<typeof router, ClientContext> = createORPCClient(link)

/**
 * Create Tanstack Query utilities with proper type inference
 */
export const orpc = createRouterUtils(orpcClient)

export const invalidateQueries = queryClient.invalidateQueries.bind(queryClient)
