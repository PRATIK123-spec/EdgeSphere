import { Outlet } from 'react-router'
import { AuthProvider } from '@/features/auth/AuthProvider'

/** AuthProvider lives inside the router so it can navigate on session expiry. */
export function RootLayout() {
  return (
    <AuthProvider>
      <Outlet />
    </AuthProvider>
  )
}
