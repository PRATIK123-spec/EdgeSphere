import { Navigate, Outlet, useLocation, type Location } from 'react-router'
import { LogOut } from 'lucide-react'

import { ErrorState, FullPageLoader } from '@/components/common/states'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/features/auth/auth-context'

/** Requires a valid session; otherwise redirects to /login and remembers the target. */
export function ProtectedRoute() {
  const { status, error, retry, logout } = useAuth()
  const location = useLocation()

  if (status === 'loading') return <FullPageLoader label="Restoring your session…" />

  if (status === 'anonymous') {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  if (status === 'error') {
    return (
      <div className="bg-grid flex min-h-svh items-center justify-center p-6">
        <div className="w-full max-w-md">
          <ErrorState error={error} title="Could not load your account" onRetry={retry} />
          <div className="mt-3 text-center">
            <Button variant="ghost" size="sm" onClick={logout}>
              <LogOut aria-hidden="true" /> Sign out
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return <Outlet />
}

/** Login/Register: bounce already-authenticated users into the app. */
export function PublicOnlyRoute() {
  const { status } = useAuth()
  const location = useLocation()

  if (status === 'loading') return <FullPageLoader label="Loading your workspace…" />

  if (status === 'authenticated') {
    return <Navigate to={redirectTarget(location)} replace />
  }

  return <Outlet />
}

function redirectTarget(location: Location): string {
  const from = (location.state as { from?: Location } | null)?.from
  if (from && from.pathname !== '/login' && from.pathname !== '/register') {
    return `${from.pathname}${from.search ?? ''}${from.hash ?? ''}`
  }
  return '/dashboard'
}
