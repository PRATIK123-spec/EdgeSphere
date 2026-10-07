import { BarChart3, Battery, CalendarClock, Cpu, Database, MemoryStick, RotateCw, Sigma, Thermometer } from 'lucide-react'
import type { ReactNode } from 'react'

import { StatTile } from '@/components/common/StatTile'
import { CardSkeleton, EmptyState, ErrorState, StatTilesSkeleton } from '@/components/common/states'
import { TimeAgo } from '@/components/common/TimeAgo'
import { Button } from '@/components/ui/button'
import { useDeviceAnalytics } from '@/features/analytics/hooks'
import { METRICS, type MetricKey, type MetricSpec } from '@/features/telemetry/thresholds'
import { formatDateTime, formatNumber } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { DeviceAnalyticsResponse } from '@/types/api'

const spec = (key: MetricKey) => METRICS.find((m) => m.key === key)!

/** Horizontal 0–100 meter with the alert threshold marked. */
function PercentMeter({ metric, value }: { metric: MetricSpec; value: number }) {
  const breached = metric.breached(value)
  const pct = Math.max(0, Math.min(100, value))
  return (
    <div>
      <div className="relative h-2.5 rounded-full bg-muted" aria-hidden="true">
        <div
          className={cn('h-full rounded-full', breached ? 'bg-status-critical' : 'bg-primary/80')}
          style={{ width: `${pct}%` }}
        />
        <div
          className="absolute -top-1 -bottom-1 w-0.5 rounded-full bg-status-critical/70"
          style={{ left: `calc(${metric.threshold}% - 1px)` }}
          title={metric.ruleLabel}
        />
      </div>
      <div className="mt-1.5 flex justify-between text-[11px] text-muted-foreground">
        <span>0%</span>
        <span>{metric.ruleLabel}</span>
        <span>100%</span>
      </div>
    </div>
  )
}

function AverageRow({ icon, metric, value }: { icon: ReactNode; metric: MetricSpec; value: number }) {
  return (
    <li className="space-y-2.5">
      <div className="flex items-baseline justify-between gap-3">
        <span className="flex items-center gap-2 text-sm text-muted-foreground">
          {icon}
          Average {metric.label}
        </span>
        <span className={cn('tabular text-xl font-semibold', metric.breached(value) && 'text-status-critical')}>
          {formatNumber(value, 2)}
          <span className="ml-0.5 text-sm font-normal text-muted-foreground">{metric.unit}</span>
        </span>
      </div>
      <PercentMeter metric={metric} value={value} />
    </li>
  )
}

/** Min ↔ max temperature span with the average and the alert threshold marked. */
function TemperatureRange({ data }: { data: DeviceAnalyticsResponse }) {
  const t = spec('temperature')
  const min = data.minimum_temperature
  const max = data.maximum_temperature
  const avg = data.average_temperature
  // Scale covers the data and the threshold, with padding.
  const lo = Math.floor(Math.min(min, t.threshold) - 5)
  const hi = Math.ceil(Math.max(max, t.threshold) + 5)
  const pos = (v: number) => `${((v - lo) / (hi - lo)) * 100}%`

  return (
    <div>
      <div className="relative h-10" aria-hidden="true">
        <div className="absolute top-1/2 right-0 left-0 h-1.5 -translate-y-1/2 rounded-full bg-muted" />
        <div
          className="absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-primary/60"
          style={{ left: pos(min), width: `calc(${pos(max)} - ${pos(min)})`, minWidth: 6 }}
        />
        {t.breached(max) && (
          // Portion of the observed range above the alert threshold.
          <div
            className="absolute top-1/2 h-1.5 -translate-y-1/2 rounded-r-full bg-status-critical/80"
            style={{
              left: pos(Math.max(min, t.threshold)),
              width: `calc(${pos(max)} - ${pos(Math.max(min, t.threshold))})`,
            }}
          />
        )}
        <div
          className="absolute top-1/2 size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-card bg-primary"
          style={{ left: pos(avg) }}
          title={`Average ${formatNumber(avg, 2)} °C`}
        />
        <div
          className="absolute top-0 bottom-0 w-0.5 -translate-x-1/2 bg-status-critical/70"
          style={{ left: pos(t.threshold) }}
          title={t.ruleLabel}
        />
      </div>
      <div className="relative mt-1 h-4 text-[11px] text-muted-foreground" aria-hidden="true">
        <span className="absolute left-0">{lo} °C</span>
        <span className="absolute -translate-x-1/2 text-status-critical" style={{ left: pos(t.threshold) }}>
          {t.threshold} °C alert
        </span>
        <span className="absolute right-0">{hi} °C</span>
      </div>
      <dl className="tabular mt-4 grid grid-cols-3 gap-3 text-center">
        {[
          { label: 'Minimum', value: min },
          { label: 'Average', value: avg },
          { label: 'Maximum', value: max },
        ].map(({ label, value }) => (
          <div key={label} className="rounded-lg border bg-background/40 px-2 py-2.5">
            <dt className="text-xs text-muted-foreground">{label}</dt>
            <dd className={cn('mt-0.5 text-lg font-semibold', t.breached(value) && 'text-status-critical')}>
              {formatNumber(value, 2)}
              <span className="ml-0.5 text-xs font-normal text-muted-foreground">°C</span>
            </dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

/**
 * Server-computed, all-time aggregates for one device
 * (GET /analytics/device/{id}). Deliberately styled apart from raw telemetry.
 */
export function AnalyticsPanel({ deviceId, onViewTelemetry }: { deviceId: number; onViewTelemetry?: () => void }) {
  const query = useDeviceAnalytics(deviceId)

  if (query.isPending) {
    return (
      <div className="space-y-6">
        <StatTilesSkeleton count={3} />
        <div className="grid gap-6 lg:grid-cols-2">
          <CardSkeleton lines={4} />
          <CardSkeleton lines={4} />
        </div>
      </div>
    )
  }

  if (query.isError) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />

  if (query.data === null) {
    return (
      <EmptyState
        icon={BarChart3}
        title="No analytics yet"
        description="Analytics are aggregated from this device's telemetry, and it has not reported any readings yet."
        action={
          <Button variant="outline" size="sm" onClick={() => void query.refetch()} disabled={query.isFetching}>
            <RotateCw className={cn(query.isFetching && 'animate-spin')} aria-hidden="true" /> Check again
          </Button>
        }
      />
    )
  }

  const data = query.data

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 rounded-xl border border-primary/25 bg-primary/5 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <Sigma className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
          <p className="text-sm">
            <span className="font-medium">Aggregate analytics</span>
            <span className="text-muted-foreground">
              {' '}
              · computed by the server over all {formatNumber(data.records, 0)} readings this device has ever reported.
              These are summaries, not individual readings.
            </span>
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          {onViewTelemetry && (
            <Button variant="outline" size="sm" onClick={onViewTelemetry}>
              Raw telemetry
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => void query.refetch()}
            disabled={query.isFetching}
            aria-label="Refresh analytics"
          >
            <RotateCw className={cn(query.isFetching && 'animate-spin')} aria-hidden="true" />
          </Button>
        </div>
      </div>

      <section aria-label="Totals" className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <StatTile
          label="Records"
          icon={Database}
          value={formatNumber(data.records, 0)}
          hint="Telemetry readings aggregated"
        />
        <StatTile
          label="Last reading"
          icon={CalendarClock}
          value={<span className="text-xl">{data.last_updated ? <TimeAgo value={data.last_updated} /> : '—'}</span>}
          hint={formatDateTime(data.last_updated)}
        />
        <StatTile
          label="Avg temperature"
          icon={Thermometer}
          className="col-span-2 lg:col-span-1"
          accent={spec('temperature').breached(data.average_temperature) ? 'border-status-critical/30 bg-status-critical/10 text-status-critical' : undefined}
          value={
            <>
              {formatNumber(data.average_temperature, 2)}
              <span className="ml-0.5 text-lg text-muted-foreground">°C</span>
            </>
          }
          hint={`Range ${formatNumber(data.minimum_temperature, 2)} – ${formatNumber(data.maximum_temperature, 2)} °C`}
        />
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="surface p-5" aria-labelledby="temp-range-heading">
          <h2 id="temp-range-heading" className="text-sm font-semibold">
            Temperature envelope
          </h2>
          <p className="mb-5 text-xs text-muted-foreground">All-time minimum, average and maximum</p>
          <TemperatureRange data={data} />
        </section>

        <section className="surface p-5" aria-labelledby="resource-avg-heading">
          <h2 id="resource-avg-heading" className="text-sm font-semibold">
            Resource averages
          </h2>
          <p className="mb-5 text-xs text-muted-foreground">Mean over all readings, against alert thresholds</p>
          <ul className="space-y-6">
            <AverageRow
              icon={<Battery className="size-4" aria-hidden="true" />}
              metric={spec('battery')}
              value={data.average_battery}
            />
            <AverageRow
              icon={<Cpu className="size-4" aria-hidden="true" />}
              metric={spec('cpu_usage')}
              value={data.average_cpu}
            />
            <AverageRow
              icon={<MemoryStick className="size-4" aria-hidden="true" />}
              metric={spec('ram_usage')}
              value={data.average_ram}
            />
          </ul>
        </section>
      </div>
    </div>
  )
}
