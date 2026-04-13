import type { StaticDataRouteOption } from '@tanstack/react-router'
import { createFileRoute, Link, Outlet, useMatches, useRouter } from '@tanstack/react-router'
import { FlaskConical } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Card, CardHeader, CardTitle } from '#/components/ui/card'

export const Route = createFileRoute('/demo')({
  staticData: { title: 'Demos', icon: FlaskConical },
  component: DemoLayout,
})

interface RouteNode {
  children?: RouteNode[]
  id: string
  to: string
  options: { staticData?: StaticDataRouteOption }
}

function DemoLayout() {
  const router = useRouter()
  const matches = useMatches()
  const { t } = useTranslation('routes')

  // Show card grid only when /demo itself is the deepest match (no child active)
  const isIndex = matches.at(-1)?.id === '/demo'

  if (!isIndex) return <Outlet />

  const childRoutes =
    (router.routeTree.children as RouteNode[] | undefined)?.find((r) => r.to === '/demo')
      ?.children ?? []

  return (
    <div className="container mx-auto max-w-3xl space-y-6 p-6">
      <header className="space-y-1">
        <h1 className="text-3xl font-bold tracking-tight">{t('/demo')}</h1>
        <p className="text-muted-foreground">Interactive demonstrations of template features.</p>
      </header>
      <div className="grid gap-4 sm:grid-cols-2">
        {childRoutes.map((route) => {
          const Icon = route.options.staticData?.icon
          const label = t(route.to, { defaultValue: route.options.staticData?.title ?? route.to })
          return (
            <Link key={route.id} to={route.to} className="group">
              <Card className="transition-colors group-hover:border-primary">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    {Icon && <Icon className="size-5 text-muted-foreground" />}
                    {label}
                  </CardTitle>
                </CardHeader>
              </Card>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
