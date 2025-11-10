import { QueryClient } from '@tanstack/react-query'
import { createORPCClient } from '@orpc/client'
import { RPCLink } from '@orpc/client/fetch'
import { createRouterUtils } from '@orpc/tanstack-query'

// Import the router VALUE (not just type) for client creation
import { router } from '@maam/server'

const url = '/rpc'

export const queryClient = new QueryClient()

/**
 * Get auth query params from localStorage
 */
function getAuthParams(): Record<string, string> {
  try {
    const authStorage = localStorage.getItem('maam-auth-storage')
    if (!authStorage) return {}

    const parsed = JSON.parse(authStorage) as { state?: { userId?: string; deviceId?: string } }
    const state = parsed?.state

    if (state?.userId && state?.deviceId) {
      return {
        user: state.userId,
        device: state.deviceId,
      }
    }
  } catch (error) {
    console.error('Failed to get auth params:', error)
  }
  return {}
}

/**
 * oRPC client context type with auth params
 */
interface ClientContext {
  userId?: string
  deviceId?: string
}

/**
 * Create oRPC link with auth query params
 */
const link = new RPCLink<ClientContext>({
  url,
  headers: async ({ context }) => {
    const authParams = getAuthParams()
    return {
      'x-user-id': context?.userId ?? authParams.user ?? '',
      'x-device-id': context?.deviceId ?? authParams.device ?? '',
    }
  },
  fetch: async (input, init) => {
    // Add auth params to URL for all requests
    const authParams = getAuthParams()
    const params = new URLSearchParams(authParams)
    const paramString = params.toString()

    let finalUrl: string
    if (typeof input === 'string') {
      finalUrl = paramString ? `${input}${input.includes('?') ? '&' : '?'}${paramString}` : input
    } else if (input instanceof URL) {
      const url = new URL(input)
      Object.entries(authParams).forEach(([key, value]) => {
        url.searchParams.set(key, value)
      })
      finalUrl = url.toString()
    } else {
      // Request object
      const url = new URL(input.url)
      Object.entries(authParams).forEach(([key, value]) => {
        url.searchParams.set(key, value)
      })
      finalUrl = url.toString()
    }

    return fetch(finalUrl, init)
  },
})

/**
 * Create oRPC client from router type
 */
export const orpcClient = createORPCClient<typeof router, ClientContext>(link)

/**
 * Create Tanstack Query utilities
 */
export const orpc = createRouterUtils(orpcClient)

export const invalidateQueries = queryClient.invalidateQueries.bind(queryClient)
