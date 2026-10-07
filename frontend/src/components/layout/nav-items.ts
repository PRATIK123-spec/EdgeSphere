import { Activity, BarChart3, Bell, Cpu, LayoutDashboard, LineChart, UserRound, type LucideIcon } from 'lucide-react'

export interface NavItem {
  to: string
  label: string
  icon: LucideIcon
}

export const primaryNav: NavItem[] = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/devices', label: 'Devices', icon: Cpu },
  { to: '/telemetry', label: 'Telemetry', icon: LineChart },
  { to: '/analytics', label: 'Analytics', icon: BarChart3 },
  { to: '/live', label: 'Live Monitor', icon: Activity },
  { to: '/alerts', label: 'Alerts', icon: Bell },
]

export const secondaryNav: NavItem[] = [{ to: '/profile', label: 'Profile', icon: UserRound }]

/** Title shown in the topbar for the current route. */
export function routeTitle(pathname: string): string {
  if (/^\/devices\/[^/]+/.test(pathname)) return 'Device'
  const match = [...primaryNav, ...secondaryNav].find((item) => pathname.startsWith(item.to))
  return match?.label ?? 'EdgeSphere'
}
