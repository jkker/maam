import { Link, useMatches, useRouter } from '@tanstack/react-router'
import { startCase } from 'es-toolkit'
import { Fragment } from 'react'
import { useTranslation } from 'react-i18next'

import { AnimatedThemeToggler } from '#/components/ui/animated-theme-toggler'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '#/components/ui/breadcrumb'
import { Separator } from '#/components/ui/separator'
import { SidebarTrigger } from '#/components/ui/sidebar'
import { cn } from '#/lib/utils'

import { buttonVariants } from '../ui/button'
import { AppUserMenu } from './app-user-menu'

export function AppHeader() {
  const router = useRouter()
  const matches = useMatches()
  const { t } = useTranslation('routes')

  const pathname = router.state.location.pathname

  const breadcrumbItems = (() => {
    const pathSegments = pathname.split('/').filter(Boolean)
    const items = [
      { path: '/', label: t('/', { defaultValue: 'Home' }), isLast: pathSegments.length === 0 },
    ]

    for (const [index, segment] of pathSegments.entries()) {
      const path = `/${pathSegments.slice(0, index + 1).join('/')}`
      const isLast = index === pathSegments.length - 1
      const match = matches.find((m) => m.pathname === path)
      const title = (match?.staticData as { title?: string } | undefined)?.title
      items.push({ path, label: t(path, { defaultValue: title ?? startCase(segment) }), isLast })
    }

    return items
  })()

  if (matches.some((match) => match.status === 'pending')) return null

  return (
    <header className="sticky top-2 z-10 mx-2 flex h-(--header-height) shrink-0 items-center gap-2 rounded-lg border border-sidebar-border bg-sidebar shadow backdrop-blur transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height)">
      <div className="flex w-full items-center gap-1 px-4 lg:gap-2 lg:px-6">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mx-2 h-full" />
        <Breadcrumb>
          <BreadcrumbList>
            {breadcrumbItems.map(({ path, label, isLast }, index) => (
              <Fragment key={path}>
                <BreadcrumbItem>
                  {isLast ? (
                    <BreadcrumbPage>{label}</BreadcrumbPage>
                  ) : (
                    <BreadcrumbLink render={<Link to={path} />}>{label}</BreadcrumbLink>
                  )}
                </BreadcrumbItem>
                {index < breadcrumbItems.length - 1 && <BreadcrumbSeparator />}
              </Fragment>
            ))}
          </BreadcrumbList>
        </Breadcrumb>
        <div className="ml-auto flex items-center gap-2">
          <AnimatedThemeToggler
            className={cn(buttonVariants({ size: 'icon', variant: 'secondary' }), 'rounded-full')}
          />
          <AppUserMenu />
        </div>
      </div>
    </header>
  )
}
