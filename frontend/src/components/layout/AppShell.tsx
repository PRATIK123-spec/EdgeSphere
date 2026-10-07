import { useState } from 'react'
import { Outlet } from 'react-router'

import { Sidebar, SidebarContent } from '@/components/layout/Sidebar'
import { Topbar } from '@/components/layout/Topbar'
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet'
import { useAuth } from '@/features/auth/auth-context'
import { RegisterDeviceProvider } from '@/features/devices/RegisterDeviceProvider'
import { RealtimeProvider } from '@/features/realtime/RealtimeProvider'

export function AppShell() {
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const { expireSession } = useAuth()

  return (
    <RealtimeProvider onSessionRejected={expireSession}>
      <div className="min-h-svh">
        <a
          href="#main"
          className="sr-only z-50 rounded-md bg-primary px-3 py-2 text-primary-foreground focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
        >
          Skip to content
        </a>

        <Sidebar />

        <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
          <SheetContent side="left" className="w-72 border-sidebar-border bg-sidebar p-0">
            <SheetTitle className="sr-only">Navigation</SheetTitle>
            <SheetDescription className="sr-only">Main application navigation</SheetDescription>
            <SidebarContent onNavigate={() => setMobileNavOpen(false)} />
          </SheetContent>
        </Sheet>

        <div className="flex min-h-svh flex-col lg:pl-64">
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
