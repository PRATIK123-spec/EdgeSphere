import { useState } from 'react'
import { Outlet } from 'react-router'

import { Sidebar, SidebarContent } from '@/components/layout/Sidebar'
import { Topbar } from '@/components/layout/Topbar'
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet'
import { useAuth } from '@/features/auth/auth-context'
import { RegisterDeviceProvider } from '@/features/devices/RegisterDeviceProvider'
import { RealtimeProvider } from '@/features/realtime/RealtimeProvider'
import { cn } from '@/lib/utils'

const COLLAPSED_KEY = 'edgesphere.sidebar-collapsed'

function readCollapsed(): boolean {
  try {
    return localStorage.getItem(COLLAPSED_KEY) === '1'
  } catch {
    return false
  }
}

export function AppShell() {
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(readCollapsed)
  const { expireSession } = useAuth()

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev
      try {
        localStorage.setItem(COLLAPSED_KEY, next ? '1' : '0')
      } catch {
        // Preference only; ignore storage failures.
      }
      return next
    })
  }

  return (
    <RealtimeProvider onSessionRejected={expireSession}>
      <div className="min-h-svh">
        <a
          href="#main"
          className="sr-only z-50 rounded-md bg-primary px-3 py-2 text-primary-foreground focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
        >
          Skip to content
        </a>

        <Sidebar collapsed={collapsed} onToggleCollapsed={toggleCollapsed} />

        <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
          <SheetContent side="left" className="w-72 border-sidebar-border bg-sidebar p-0">
            <SheetTitle className="sr-only">Navigation</SheetTitle>
            <SheetDescription className="sr-only">Main application navigation</SheetDescription>
            <SidebarContent onNavigate={() => setMobileNavOpen(false)} />
          </SheetContent>
        </Sheet>

        <div
          className={cn(
            'flex min-h-svh min-w-0 flex-col transition-[padding] duration-200',
            collapsed ? 'lg:pl-16' : 'lg:pl-64',
          )}
        >
          <Topbar onOpenMenu={() => setMobileNavOpen(true)} />
          <main id="main" className="flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
            <div className="mx-auto w-full max-w-7xl">
              <RegisterDeviceProvider>
                <Outlet />
              </RegisterDeviceProvider>
            </div>
          </main>
        </div>
      </div>
    </RealtimeProvider>
  )
}
