import type { TRPCRouter } from '@maam/server'

import { QueryClient } from '@tanstack/react-query'
import { createTRPCClient, httpBatchLink, httpSubscriptionLink, splitLink } from '@trpc/client'
import { createTRPCOptionsProxy } from '@trpc/tanstack-react-query'

const url = '/trpc'

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
 * Custom fetch that adds auth query params to all requests
 */
function fetchWithAuth(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const params = new URLSearchParams(getAuthParams())
  const paramString = params.toString()

  let finalUrl: string
  if (typeof input === 'string') {
    finalUrl = paramString ? `${input}${input.includes('?') ? '&' : '?'}${paramString}` : input
  } else if (input instanceof URL) {
    const url = new URL(input)
    Object.entries(getAuthParams()).forEach(([key, value]) => {
      url.searchParams.set(key, value)
    })
    finalUrl = url.toString()
  } else {
    // Request object
    const url = new URL(input.url)
    Object.entries(getAuthParams()).forEach(([key, value]) => {
      url.searchParams.set(key, value)
    })
    finalUrl = url.toString()
  }

  return fetch(finalUrl, init)
}

/**
 * Create tRPC React Query hooks
 */
export const trpcClient = createTRPCClient<TRPCRouter>({
  links: [
    splitLink({
      condition: (op) => op.type === 'subscription',
      true: httpSubscriptionLink({
        url,
        EventSource: class extends EventSource {
          constructor(url: string | URL, eventSourceInitDict?: EventSourceInit) {
            // Add auth params to SSE URL
            const params = new URLSearchParams(getAuthParams())
            const paramString = params.toString()
            const finalUrl = paramString
              ? `${url}${url.toString().includes('?') ? '&' : '?'}${paramString}`
              : url
            super(finalUrl, eventSourceInitDict)
          }
        },
      }),
      false: httpBatchLink({
        url,
        fetch: fetchWithAuth,
      }),
    }),
  ],
})

export const trpc = createTRPCOptionsProxy<TRPCRouter>({
  client: trpcClient,
  queryClient,
})

export const invalidateQueries = queryClient.invalidateQueries.bind(queryClient)
