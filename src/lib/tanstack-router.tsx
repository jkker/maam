import { RouterProvider, createRouter } from '@tanstack/react-router'
import prefill from 'prefill'

import { routeTree } from '../routeTree.gen'
import { getContext } from './tanstack-query'

// eslint-disable-next-line react/only-export-components -- router config, not a component module
function NotFound() {
  return (
    <main className="flex min-h-[50vh] items-center justify-center">
      <div className="text-center">
        <h1 className="text-4xl font-bold">404</h1>
        <p className="mt-2 text-muted-foreground">Page not found</p>
      </div>
    </main>
  )
}

const createTanstackRouter = (options?: Partial<Parameters<typeof createRouter>[0]>) =>
  createRouter({
    routeTree,
    context: getContext(),
    defaultNotFoundComponent: NotFound,
    defaultPreload: 'intent',
    defaultPreloadStaleTime: 0,
    scrollRestoration: true,
    defaultStructuralSharing: true,
    defaultViewTransition: true,
    defaultHashScrollIntoView: true,
    ...options,
  })
const router = createTanstackRouter()

export const TanstackRouterProvider = prefill(RouterProvider, {
  router,
})

// Register the router instance for type safety
declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
  // https://tanstack.com/router/latest/docs/framework/react/guide/static-route-data
  interface StaticDataRouteOption {
    title?: string
    icon?: React.ComponentType<{ className?: string }>
  }
}
