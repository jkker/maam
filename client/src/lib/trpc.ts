import type { TRPCRouter } from '@maam/server'

import { QueryClient } from '@tanstack/react-query'
import { createTRPCClient, httpBatchLink, httpSubscriptionLink, splitLink } from '@trpc/client'
import { createTRPCOptionsProxy } from '@trpc/tanstack-react-query'

const url = '/trpc'

export const queryClient = new QueryClient()
/**
 * Create tRPC React Query hooks
 */
export const trpcClient = createTRPCClient<TRPCRouter>({
  links: [
    splitLink({
      condition: (op) => op.type === 'subscription',
      true: httpSubscriptionLink({ url }),
      false: httpBatchLink({ url }),
    }),
  ],
})

export const trpc = createTRPCOptionsProxy<TRPCRouter>({
  client: trpcClient,
  queryClient,
})

export const invalidateQueries = queryClient.invalidateQueries.bind(queryClient)
