import { Activity, AlertTriangle, Battery, Cpu, MemoryStick, Thermometer, type LucideIcon } from 'lucide-react'

import { EmptyState, ErrorState } from '@/components/common/states'
import { TimeAgo } from '@/components/common/TimeAgo'
import { Skeleton } from '@/components/ui/skeleton'
import { useLatestTelemetry, LIVE_POLL_MS } from '@/features/telemetry/hooks'
import { METRICS, type MetricKey } from '@/features/telemetry/thresholds'
import { formatNumber } from '@/lib/format'
import { cn } from '@/lib/utils'

const ICONS: Record<MetricKey, LucideIcon> = {
  temperature: Thermometer,
  battery: Battery,
  cpu_usage: Cpu,
  ram_usage: MemoryStick,
}

/** Meter fill on a 0–100 scale (percent metrics; temperature in °C). */
function meterPercent(value: number): number {
  return Math.max(0, Math.min(100, value))
}

export function LatestReadingPanel({ deviceId }: { deviceId: number }) {
  const query = useLatestTelemetry(deviceId)
  const reading = query.data

  return (
    <section className="surface p-5" aria-labelledby="latest-reading-heading">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 id="latest-reading-heading" className="text-sm font-semibold">
            Latest reading
          </h2>
          <p className="text-xs text-muted-foreground">
            Polled every {LIVE_POLL_MS / 1000}s from the most recent telemetry record
          </p>
        </div>
        {reading && (
          <span className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs text-muted-foreground">
            <Activity className={cn('size-3', query.isFetching && 'text-primary')} aria-hidden="true" />
            Reported <TimeAgo value={reading.created_at} />
          </span>
        )}
      </div>

      {query.isPending ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-hidden="true">
          {METRICS.map((m) => (
            <div key={m.key} className="rounded-lg border p-4">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="mt-3 h-7 w-20" />
              <Skeleton className="mt-4 h-1.5 w-full" />
            </div>
          ))}
        </div>
      ) : query.isError ? (
        <ErrorState compact error={query.error} onRetry={() => void query.refetch()} />
      ) : !reading ? (
        <EmptyState
          icon={Activity}
          title="No telemetry received yet"
          description="This device has not reported. Readings appear here as soon as it posts to POST /telemetry/ with its device key."
        />
      ) : (
        <ul className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {METRICS.map((metric) => {
            const value = reading[metric.key]
            const breached = metric.breached(value)
            const Icon = ICONS[metric.key]
            return (
              <li
                key={metric.key}
                className={cn(
                  'rounded-lg border bg-background/40 p-4',
                  breached && 'border-status-critical/40 bg-status-critical/5',
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                    <Icon className="size-3.5" aria-hidden="true" />
                    {metric.label}
                  </span>
                  {breached && (
                    <AlertTriangle className="size-3.5 text-status-critical" aria-label="Threshold breached" />
                  )}
                </div>
                <div className="tabular mt-2 text-2xl font-semibold tracking-tight">
                  {formatNumber(value)}
                  <span className="ml-1 text-sm font-normal text-muted-foreground">{metric.unit}</span>
                </div>
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden="true">
                  <div
                    className={cn(
                      'h-full rounded-full transition-[width] duration-700',
                      breached ? 'bg-status-critical' : 'bg-primary/70',
                    )}
                    style={{ width: `${meterPercent(value)}%` }}
                  />
                </div>
                <div className={cn('mt-2 text-[11px]', breached ? 'text-status-critical' : 'text-muted-foreground')}>
                  {breached ? 'Outside alert threshold' : metric.ruleLabel}
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
