import { NavLink } from 'react-router'
import { Logo } from '@/components/common/Logo'
import { ApiStatusIndicator } from '@/components/layout/ApiStatusIndicator'
import { primaryNav, secondaryNav, type NavItem } from '@/components/layout/nav-items'
import { cn } from '@/lib/utils'

function SidebarLink({ item, onNavigate }: { item: NavItem; onNavigate?: () => void }) {
  const Icon = item.icon
  return (
    <NavLink
      to={item.to}
      onClick={onNavigate}
      className={({ isActive }) =>
        cn(
          'group relative flex h-9 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors',
          'focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:outline-none',
          isActive
            ? 'bg-sidebar-accent text-sidebar-accent-foreground'
            : 'text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-foreground',
        )
      }
    >
      {({ isActive }) => (
        <>
          <span
            aria-hidden="true"
            className={cn(
              'absolute top-2 bottom-2 left-0 w-0.5 rounded-full bg-primary transition-opacity',
              isActive ? 'opacity-100' : 'opacity-0',
            )}
          />
          <Icon
            className={cn('size-4', isActive ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground')}
            aria-hidden="true"
          />
          {item.label}
        </>
      )}
    </NavLink>
  )
}

/** Sidebar body, shared by the desktop rail and the mobile sheet. */
export function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex h-16 items-center px-5">
        <Logo />
      </div>

      <nav aria-label="Main" className="flex flex-1 flex-col gap-6 overflow-y-auto px-3 py-4">
        <div>
          <div className="mb-2 px-3 font-mono text-[10px] font-medium tracking-[0.16em] text-muted-foreground/80 uppercase">
            Operations
          </div>
          <ul className="space-y-0.5">
            {primaryNav.map((item) => (
              <li key={item.to}>
                <SidebarLink item={item} onNavigate={onNavigate} />
              </li>
            ))}
          </ul>
        </div>

        <div>
          <div className="mb-2 px-3 font-mono text-[10px] font-medium tracking-[0.16em] text-muted-foreground/80 uppercase">
            Account
          </div>
          <ul className="space-y-0.5">
            {secondaryNav.map((item) => (
              <li key={item.to}>
                <SidebarLink item={item} onNavigate={onNavigate} />
              </li>
            ))}
          </ul>
        </div>
      </nav>

      <div className="border-t border-sidebar-border p-4">
        <ApiStatusIndicator />
      </div>
    </div>
  )
}

export function Sidebar() {
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-sidebar-border bg-sidebar lg:block">
      <SidebarContent />
    </aside>
  )
}
