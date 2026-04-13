import {
  Outlet,
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from '@tanstack/react-router'
import { expect, test } from 'vite-plus/test'
import { render } from 'vitest-browser-react'

import { SidebarProvider } from '#/components/ui/sidebar'
import { ReactI18nextProvider } from '#/lib/i18next'

import { AppHeader } from './app-header'

/**
 * Creates a minimal test router that avoids the TanStack Start SSR shell
 * (`shellComponent` with `HeadContent`/`Scripts`) which hangs in browser tests.
 */
async function createTestRouterForPath(initialPath: string) {
  const rootRoute = createRootRoute({
    component: () => (
      <ReactI18nextProvider>
        <SidebarProvider>
          <AppHeader />
        </SidebarProvider>
      </ReactI18nextProvider>
    ),
  })

  const indexRoute = createRoute({ getParentRoute: () => rootRoute, path: '/' })
  const demoRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/demo',
    staticData: { title: 'Demos' },
    component: () => <Outlet />,
  })
  const demoFormRoute = createRoute({
    getParentRoute: () => demoRoute,
    path: '/form',
    staticData: { title: 'Form' },
  })
  const aboutRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/about',
    staticData: { title: 'About' },
  })

  const routeTree = rootRoute.addChildren([
    indexRoute,
    demoRoute.addChildren([demoFormRoute]),
    aboutRoute,
  ])

  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: [initialPath] }),
  })

  await router.load()
  return router
}

test('renders breadcrumbs correctly for home path', async () => {
  const router = await createTestRouterForPath('/')
  const screen = await render(<RouterProvider router={router} />)

  await expect.element(screen.getByText('Home')).toBeVisible()
})

test('renders breadcrumbs for nested demo paths', async () => {
  const router = await createTestRouterForPath('/demo/form')
  const screen = await render(<RouterProvider router={router} />)

  await expect.element(screen.getByRole('link', { name: 'Home', exact: true })).toBeVisible()
  await expect.element(screen.getByRole('link', { name: 'Demos', exact: true })).toBeVisible()
  await expect.element(screen.getByText('Form')).toBeVisible()
})

test('renders staticData title for leaf routes', async () => {
  const router = await createTestRouterForPath('/about')
  const screen = await render(<RouterProvider router={router} />)

  await expect.element(screen.getByRole('link', { name: 'Home', exact: true })).toBeVisible()
  await expect.element(screen.getByText('About')).toBeVisible()
})
