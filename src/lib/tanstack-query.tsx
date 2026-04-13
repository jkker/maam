import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

let context: { queryClient: QueryClient } | undefined

// eslint-disable-next-line react/only-export-components -- shared context, not a component
export function getContext() {
  if (context) return context

  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        refetchOnWindowFocus: true,
        refetchOnReconnect: true,
      },
    },
  })

  return (context = { queryClient })
}

export function TanStackQueryProvider({ children }: React.PropsWithChildren) {
  return <QueryClientProvider client={getContext().queryClient}>{children}</QueryClientProvider>
}
