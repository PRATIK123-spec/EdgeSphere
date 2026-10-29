import { NavLink, useMatch } from 'react-router'
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react'

import { Logo } from '@/components/common/Logo'
import { ApiStatusIndicator } from '@/components/layout/ApiStatusIndicator'
import { navGroups, type NavItem } from '@/components/layout/nav-items'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useDashboardSummary } from '@/features/dashboard/hooks'
import { cn } from '@/lib/utils'

function SidebarLink({
  item,
  collapsed,
  count,
  onNavigate,
}: {
  item: NavItem
  collapsed: boolean
  count?: number
  onNavigate?: () => void
}) {
  const Icon = item.icon
  // Computed here rather than via NavLink render props: Radix Slot (tooltip
  // trigger) would stringify a function className.
  const isActive = useMatch({ path: item.to, end: false }) !== null
  const showCount = count !== undefined && count > 0
  const countLabel = showCount ? `${count} active` : undefined

  const link = (
    <NavLink
      to={item.to}
      onClick={onNavigate}
      aria-label={collapsed ? [item.label, countLabel].filter(Boolean).join(', ') : undefined}
      className={cn(
          'group relative flex h-9 items-center gap-3 rounded-lg text-sm font-medium transition-colors',
          'focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:outline-none',
          collapsed ? 'justify-center' : 'px-3',
          isActive
            ? 'elevation-1 bg-sidebar-accent text-sidebar-accent-foreground'
          : 'text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-foreground',
      )}
    >
          <span
            aria-hidden="true"
            className={cn(
              'absolute top-2 bottom-2 w-1 rounded-r-full bg-primary transition-opacity',
              collapsed ? '-left-2.5' : '-left-3',
              isActive ? 'opacity-100' : 'opacity-0',
            )}
          />
          <span className="relative">
            <Icon
              className={cn('size-4', isActive ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground')}
              aria-hidden="true"
            />
            {collapsed && showCount && (
              <span
                aria-hidden="true"
                className="absolute -top-1 -right-1 size-2 rounded-full bg-status-critical ring-2 ring-sidebar"
              />
            )}
          </span>
          {!collapsed && <span className="truncate">{item.label}</span>}
          {!collapsed && showCount && (
            <span
              className="tabular ml-auto rounded-full border border-status-critical/30 bg-status-critical/10 px-1.5 font-mono text-[10px] leading-4 font-semibold text-foreground"
              aria-label={countLabel}
            >
              {count > 99 ? '99+' : count}
            </span>
          )}
    </NavLink>
  )

  if (!collapsed) return link
  return (
    <Tooltip>
      <TooltipTrigger asChild>{link}</TooltipTrigger>
      <TooltipContent side="right" sideOffset={10}>
        {item.label}
        {countLabel && <span className="opacity-70">· {countLabel}</span>}
      </TooltipContent>
    </Tooltip>
  )
}

/** Sidebar body, shared by the desktop rail and the mobile drawer. */
export function SidebarContent({
  collapsed = false,
  onNavigate,
  onToggleCollapsed,
}: {
  collapsed?: boolean
  onNavigate?: () => void
  /** Desktop only: renders the collapse/expand control. */
  onToggleCollapsed?: () => void
}) {
  const openAlerts = useDashboardSummary().data?.alerts.active_total

  return (
    <div className="flex h-full flex-col">
      <div
        className={cn(
          'flex h-16 shrink-0 items-center border-b border-sidebar-border',
          collapsed ? 'justify-center' : 'px-5',
        )}
      >
        <Logo compact={collapsed} />
      </div>

      <nav
        aria-label="Main"
        className={cn('flex flex-1 flex-col gap-5 overflow-y-auto py-4', collapsed ? 'px-2.5' : 'px-3')}
      >
        {navGroups.map((group, index) => (
          <div key={group.label} role="group" aria-label={group.label}>
            {collapsed ? (
              index > 0 && <div className="mx-1.5 mb-3 border-t border-sidebar-border" aria-hidden="true" />
            ) : (
              <div className="text-channel-label mb-1.5 px-3 text-[10px] tracking-[0.16em]" aria-hidden="true">
                {group.label}
              </div>
            )}
            <ul className="space-y-0.5">
              {group.items.map((item) => (
                <li key={item.to}>
                  <SidebarLink
                    item={item}
                    collapsed={collapsed}
                    count={item.badge === 'openAlerts' ? openAlerts : undefined}
                    onNavigate={onNavigate}
                  />
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      <div
        className={cn(
          'flex flex-col gap-2 border-t border-sidebar-border',
          collapsed ? 'items-center px-2.5 py-3' : 'p-3',
        )}
      >
        <ApiStatusIndicator variant={collapsed ? 'dot' : 'full'} />
        {onToggleCollapsed && (
          <button
            type="button"
            onClick={onToggleCollapsed}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-expanded={!collapsed}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className={cn(
              'flex h-8 items-center gap-2 rounded-lg text-xs font-medium text-muted-foreground transition-colors',
              'hover:bg-sidebar-accent/60 hover:text-sidebar-foreground focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:outline-none',
              collapsed ? 'w-9 justify-center' : 'w-full px-3',
            )}
          >
            {collapsed ? (
              <PanelLeftOpen className="size-4" aria-hidden="true" />
            ) : (
              <>
                <PanelLeftClose className="size-4" aria-hidden="true" /> Collapse sidebar
              </>
            )}
          </button>
        )}
      </div>
    </div>
  )
}

/** Fixed desktop rail (lg+). Mobile uses SidebarContent inside a drawer. */
export function Sidebar({ collapsed, onToggleCollapsed }: { collapsed: boolean; onToggleCollapsed: () => void }) {
  return (
    <aside
      className={cn(
        'fixed inset-y-0 left-0 z-30 hidden border-r border-sidebar-border bg-sidebar transition-[width] duration-200 lg:block',
        collapsed ? 'w-16' : 'w-64',
      )}
    >
      <SidebarContent collapsed={collapsed} onToggleCollapsed={onToggleCollapsed} />
    </aside>
  )
}
