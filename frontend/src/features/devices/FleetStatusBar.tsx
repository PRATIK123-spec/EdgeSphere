import { Power, Wifi, Wrench, CircleHelp, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { FleetSummary } from '@/features/devices/status'

interface Segment {
  key: keyof Omit<FleetSummary, 'total'>
  label: string
  icon: LucideIcon
  fill: string
}

const SEGMENTS: Segment[] = [
  { key: 'online', label: 'Online', icon: Wifi, fill: 'bg-status-online' },
  { key: 'offline', label: 'Offline', icon: Power, fill: 'bg-status-offline' },
  { key: 'maintenance', label: 'Maintenance', icon: Wrench, fill: 'bg-status-warning' },
  { key: 'other', label: 'Unknown', icon: CircleHelp, fill: 'bg-muted-foreground/50' },
]

/**
 * Part-to-whole of device states as a single segmented bar.
 * Each state carries icon + label + count, so colour is never the only cue.
 */
export function FleetStatusBar({ summary }: { summary: FleetSummary }) {
  const visible = SEGMENTS.filter((s) => summary[s.key] > 0 || s.key === 'online' || s.key === 'offline')
  const pct = (n: number) => (summary.total ? Math.round((n / summary.total) * 100) : 0)

  return (
    <div>
      <div
        className="flex h-3 w-full gap-0.5 overflow-hidden rounded-full bg-muted"
        role="img"
        aria-label={visible.map((s) => `${s.label}: ${summary[s.key]}`).join(', ')}
      >
        {visible.map((segment) =>
          summary[segment.key] > 0 ? (
            <div
              key={segment.key}
              title={`${segment.label}: ${summary[segment.key]} (${pct(summary[segment.key])}%)`}
              className={cn('h-full transition-[flex-grow] duration-500 first:rounded-l-full last:rounded-r-full', segment.fill)}
              style={{ flexGrow: summary[segment.key], flexBasis: 0 }}
            />
          ) : null,
        )}
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4">
        {visible.map(({ key, label, icon: Icon, fill }) => (
          <div key={key} className="flex items-center gap-2.5">
            <span className={cn('size-2.5 shrink-0 rounded-sm', fill)} aria-hidden="true" />
            <Icon className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
            <dt className="text-sm text-muted-foreground">{label}</dt>
            <dd className="tabular ml-auto text-sm font-medium sm:ml-1">
              {summary[key]}
              <span className="ml-1 text-xs font-normal text-muted-foreground">{pct(summary[key])}%</span>
            </dd>
          </div>
        ))}
      </dl>
    </div>
  )
}
