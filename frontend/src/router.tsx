import { Navigate, createBrowserRouter } from 'react-router'

import { AppShell } from '@/components/layout/AppShell'
import { RootLayout } from '@/components/layout/RootLayout'
import { ProtectedRoute, PublicOnlyRoute } from '@/components/layout/route-guards'
import { FullPageLoader } from '@/components/common/states'
import { NotFoundPage, RouteErrorPage } from '@/pages/NotFoundPage'

// Pages are code-split per route.
export const router = createBrowserRouter([
  {
    element: <RootLayout />,
    errorElement: <RouteErrorPage />,
    // Shown while the first lazily-loaded route module downloads.
    hydrateFallbackElement: <FullPageLoader />,
    children: [
      { index: true, element: <Navigate to="/dashboard" replace /> },
      {
        element: <PublicOnlyRoute />,
        children: [
          {
            path: 'login',
            lazy: () => import('@/pages/LoginPage').then((m) => ({ Component: m.LoginPage })),
          },
          {
            path: 'register',
            lazy: () => import('@/pages/RegisterPage').then((m) => ({ Component: m.RegisterPage })),
          },
        ],
      },
      {
        element: <ProtectedRoute />,
        children: [
          {
            element: <AppShell />,
            children: [
              {
                path: 'dashboard',
                lazy: () => import('@/pages/DashboardPage').then((m) => ({ Component: m.DashboardPage })),
              },
              {
                path: 'devices',
                lazy: () => import('@/pages/DevicesPage').then((m) => ({ Component: m.DevicesPage })),
              },
              {
                path: 'devices/:id',
                lazy: () =>
                  import('@/pages/DeviceDetailPage').then((m) => ({ Component: m.DeviceDetailPage })),
              },
              {
                path: 'telemetry',
                lazy: () => import('@/pages/TelemetryPage').then((m) => ({ Component: m.TelemetryPage })),
              },
              {
                path: 'analytics',
                lazy: () => import('@/pages/AnalyticsPage').then((m) => ({ Component: m.AnalyticsPage })),
              },
              {
                path: 'live',
                lazy: () => import('@/pages/LiveMonitorPage').then((m) => ({ Component: m.LiveMonitorPage })),
              },
              {
                path: 'alerts',
                lazy: () => import('@/pages/AlertsPage').then((m) => ({ Component: m.AlertsPage })),
              },
              {
                path: 'profile',
                lazy: () => import('@/pages/ProfilePage').then((m) => ({ Component: m.ProfilePage })),
              },
            ],
          },
        ],
      },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
])
