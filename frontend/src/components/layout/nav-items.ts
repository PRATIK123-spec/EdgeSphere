import { Activity, BarChart3, Bell, Cpu, LayoutDashboard, LineChart, UserRound, type LucideIcon } from 'lucide-react'

export interface NavItem {
  to: string
  label: string
  icon: LucideIcon
  /** Shows the count of open alerts next to the label. */
  badge?: 'openAlerts'
}

export interface NavGroup {
  label: string
  items: NavItem[]
}

export const navGroups: NavGroup[] = [
  {
    label: 'Monitor',
    items: [
      { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { to: '/live', label: 'Live Monitor', icon: Activity },
      { to: '/alerts', label: 'Alerts', icon: Bell, badge: 'openAlerts' },
    ],
  },
  {
    label: 'Fleet',
    items: [
      { to: '/devices', label: 'Devices', icon: Cpu },
      { to: '/telemetry', label: 'Telemetry', icon: LineChart },
      { to: '/analytics', label: 'Analytics', icon: BarChart3 },
    ],
  },
  {
    label: 'Account',
    items: [{ to: '/profile', label: 'Profile', icon: UserRound }],
  },
]

/** Group and title shown in the topbar for the current route. */
export function routeMeta(pathname: string): { group?: string; title: string } {
  if (/^\/devices\/[^/]+/.test(pathname)) return { group: 'Fleet', title: 'Device' }
  for (const group of navGroups) {
    const item = group.items.find((i) => pathname.startsWith(i.to))
    if (item) return { group: group.label, title: item.label }
  }
  return { title: 'EdgeSphere' }
}
