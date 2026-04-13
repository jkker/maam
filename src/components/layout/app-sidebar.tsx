import type { StaticDataRouteOption } from '@tanstack/react-router'
import { Link, useRouter } from '@tanstack/react-router'
import { type } from 'arktype'
import { GalleryVerticalEnd } from 'lucide-react'
import * as React from 'react'
import { useTranslation } from 'react-i18next'

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubItem,
} from '#/components/ui/sidebar'
import { cn } from '#/lib/utils'

interface AppSidebarProps extends React.ComponentProps<typeof Sidebar> {
  maxDepth?: number
}

interface RouteNode {
  children?: RouteNode[]
  id: string
  path: string
  to: string

  options: {
    staticData?: StaticDataRouteOption
  }
}

export function AppSidebar({ maxDepth = 3, ...props }: AppSidebarProps) {
  const router = useRouter()
  const { t } = useTranslation('routes')

  const renderRoute = ({ options: { staticData }, id, to, children }: RouteNode, depth = 0) => {
    if (depth >= maxDepth) return null

    const Item = depth > 0 ? SidebarMenuSubItem : SidebarMenuItem
    const Icon = staticData?.icon
    const label = t(to, { defaultValue: staticData?.title ?? to })

    return (
      <Item key={id}>
        <Link
          to={to}
          className={cn(
            'flex h-7 min-w-0 -translate-x-px items-center gap-2 overflow-hidden rounded-md px-2 text-sidebar-foreground ring-sidebar-ring outline-hidden group-data-[collapsible=icon]:hidden hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 active:bg-sidebar-accent active:text-sidebar-accent-foreground disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50 data-[size=md]:text-sm data-[size=sm]:text-xs data-active:bg-sidebar-accent data-active:text-sidebar-accent-foreground [&>span:last-child]:truncate [&>svg]:size-4 [&>svg]:shrink-0 [&>svg]:text-sidebar-accent-foreground',
          )}
        >
          {Icon && <Icon className="size-4" />}
          <span>{label}</span>
        </Link>
        {children?.length && depth < maxDepth - 1 && (
          <SidebarMenuSub>{children.map((child) => renderRoute(child, depth + 1))}</SidebarMenuSub>
        )}
      </Item>
    )
  }

  return (
    <Sidebar variant="floating" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              render={
                <a href="#">
                  <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                    <GalleryVerticalEnd className="size-4" />
                  </div>
                  <div className="flex flex-col gap-0.5 leading-none">
                    <span className="font-medium">Documentation</span>
                    <span className="">v1.0.0</span>
                  </div>
                </a>
              }
            />
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarMenu className="gap-2">
            {type
              .instanceOf<RouteNode[]>(Array)
              .assert(router.routeTree.children)
              ?.filter((route) => !route.to.startsWith('/api'))
              .map((route) => renderRoute(route))}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  )
}
