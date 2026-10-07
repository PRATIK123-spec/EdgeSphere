import { Link, useLocation } from 'react-router'
import { LogOut, Menu, ShieldCheck, UserRound } from 'lucide-react'

import { ThemeToggle } from '@/components/common/ThemeToggle'
import { LiveIndicator } from '@/components/layout/LiveIndicator'
import { routeTitle } from '@/components/layout/nav-items'
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

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b bg-background/80 px-4 backdrop-blur-md supports-[backdrop-filter]:bg-background/60 sm:px-6">
      <Button
        variant="ghost"
        size="icon"
        className="lg:hidden"
        onClick={onOpenMenu}
        aria-label="Open navigation"
      >
        <Menu aria-hidden="true" />
      </Button>

      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium">{routeTitle(pathname)}</div>
      </div>

      <div className="flex items-center gap-1">
        <LiveIndicator className="mr-1" />
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
