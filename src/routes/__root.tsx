import type { QueryClient } from '@tanstack/react-query'
import { Outlet, createRootRouteWithContext } from '@tanstack/react-router'

import { AppHeader } from '#/components/layout/app-header'
import { AppSidebar } from '#/components/layout/app-sidebar'
import { SidebarInset, SidebarProvider } from '#/components/ui/sidebar'
import { TanstackDevtools } from '#/lib/tanstack-devtools'

interface RootRouteContext {
  queryClient: QueryClient
}

export const Route = createRootRouteWithContext<RootRouteContext>()({
  component: () => (
    <SidebarProvider
      style={{
        '--sidebar-width': 'calc(var(--spacing) * 56)',
        '--header-height': 'calc(var(--spacing) * 12)',
      }}
    >
      <AppSidebar />
      <SidebarInset className="min-h-screen pt-2">
        <AppHeader />
        <main className="flex-1 pt-2">
          <Outlet />
        </main>
        <TanstackDevtools />
      </SidebarInset>
    </SidebarProvider>
  ),
})
