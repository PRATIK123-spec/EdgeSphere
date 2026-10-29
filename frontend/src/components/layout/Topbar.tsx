import { Link, useLocation } from 'react-router'
import { ChevronRight, LogOut, Menu, ShieldCheck, UserRound } from 'lucide-react'

import { ThemeToggle } from '@/components/common/ThemeToggle'
import { ApiStatusIndicator } from '@/components/layout/ApiStatusIndicator'
import { LiveIndicator } from '@/components/layout/LiveIndicator'
import { routeMeta } from '@/components/layout/nav-items'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useAuth } from '@/features/auth/auth-context'
import { initials } from '@/lib/format'

export function Topbar({ onOpenMenu }: { onOpenMenu: () => void }) {
  const { user, logout } = useAuth()
  const { pathname } = useLocation()
  const { group, title } = routeMeta(pathname)

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center gap-2 border-b bg-background/80 px-3 backdrop-blur-md supports-[backdrop-filter]:bg-background/60 sm:gap-3 sm:px-6 lg:px-8">
      <Button
        variant="ghost"
        size="icon"
        className="-ml-1 lg:hidden"
        onClick={onOpenMenu}
        aria-label="Open navigation"
      >
        <Menu aria-hidden="true" />
      </Button>

      <nav aria-label="Breadcrumb" className="min-w-0 flex-1">
        <ol className="flex min-w-0 items-center gap-1.5 text-sm">
          {group && (
            <li className="hidden items-center gap-1.5 text-muted-foreground sm:flex">
              {group}
              <ChevronRight className="size-3.5 opacity-60" aria-hidden="true" />
            </li>
          )}
          <li className="truncate font-medium" aria-current="page">
            {title}
          </li>
        </ol>
      </nav>

      <div className="flex items-center gap-1 sm:gap-1.5">
        <ApiStatusIndicator variant="pill" className="lg:hidden" />
        <LiveIndicator />
        <ThemeToggle />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-10 gap-2.5 px-2" aria-label="Account menu">
              <Avatar className="size-7">
                <AvatarFallback className="bg-primary/15 text-[11px] font-semibold text-primary">
                  {user ? initials(user.full_name) : '…'}
                </AvatarFallback>
              </Avatar>
              <span className="hidden max-w-40 truncate text-sm font-medium sm:block">
                {user?.full_name}
              </span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-60">
            <DropdownMenuLabel className="font-normal">
              <div className="truncate text-sm font-medium">{user?.full_name}</div>
              <div className="truncate text-xs text-muted-foreground">{user?.email}</div>
              {user?.is_admin && (
                <div className="mt-1.5 inline-flex items-center gap-1 text-[11px] text-primary">
                  <ShieldCheck className="size-3" aria-hidden="true" /> Administrator
                </div>
              )}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link to="/profile">
                <UserRound aria-hidden="true" /> Profile
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onSelect={logout}>
              <LogOut aria-hidden="true" /> Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
