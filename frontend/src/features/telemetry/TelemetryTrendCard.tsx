import { useMemo } from 'react'
import { ArrowRight, LineChart, RotateCw } from 'lucide-react'

import { EmptyState, ErrorState } from '@/components/common/states'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useRealtimeLive } from '@/features/realtime/realtime-context'
import { useLatestTelemetry, useRecentTelemetry } from '@/features/telemetry/hooks'
import { MetricChart } from '@/features/telemetry/MetricChart'
import { buildSeries, metricStats, toReadings } from '@/features/telemetry/series'
import { METRICS } from '@/features/telemetry/thresholds'
import { formatNumber } from '@/lib/format'
import { cn } from '@/lib/utils'

/** Most recent readings shown in the compact trend. */
const TREND_READINGS = 60

/**
 * Compact sparkline trend for the device Overview: the newest 60 readings
 * (GET /telemetry/{id}?limit=60). Live readings are appended by the realtime
 * layer; without a live socket, the latest-reading poll flags newer data.
 */
export function TelemetryTrendCard({
  deviceId,
  onViewHistory,
}: {
  deviceId: number
  onViewHistory: () => void
}) {
  const recent = useRecentTelemetry(deviceId, TREND_READINGS)
  const latest = useLatestTelemetry(deviceId)
  const live = useRealtimeLive()

  const readings = useMemo(() => toReadings(recent.data?.items ?? []), [recent.data])
  const series = useMemo(() => buildSeries(readings), [readings])

  const newestCharted = recent.data?.items[0]?.id ?? 0
  const hasNewer = !live && latest.data != null && latest.data.id > newestCharted

  return (
    <section className="surface p-5" aria-labelledby="trend-heading">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 id="trend-heading" className="text-sm font-semibold">
            Recent trend
          </h2>
          <p className="text-xs text-muted-foreground">
            {readings.length > 0
              ? `Last ${readings.length} ${readings.length === 1 ? 'reading' : 'readings'}${live ? ' · updating live' : ''}`
              : 'Telemetry history'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {hasNewer && (
            <Button variant="outline" size="sm" onClick={() => void recent.refetch()} disabled={recent.isFetching}>
              <RotateCw className={cn(recent.isFetching && 'animate-spin')} aria-hidden="true" />
              New readings
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={onViewHistory}>
            Full history <ArrowRight aria-hidden="true" />
          </Button>
        </div>
      </div>

      {recent.isPending ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-hidden="true">
          {METRICS.map((m) => (
            <div key={m.key} className="rounded-lg border p-3">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="mt-3 h-14 w-full" />
            </div>
          ))}
        </div>
      ) : recent.isError ? (
        <ErrorState compact error={recent.error} onRetry={() => void recent.refetch()} />
      ) : readings.length === 0 ? (
        <EmptyState
          icon={LineChart}
          className="py-8"
          title="No trend yet"
          description="A trend appears once this device has reported telemetry."
        />
      ) : (
        <ul className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {METRICS.map((spec) => {
            const stats = metricStats(readings, spec.key)
            return (
              <li key={spec.key} className="rounded-lg border bg-background/40 p-3">
                <div className="text-xs font-medium text-muted-foreground">{spec.label}</div>
                {stats && (
                  <div className="tabular mt-0.5 text-[11px] whitespace-nowrap text-muted-foreground/80">
                    {formatNumber(stats.min)}–{formatNumber(stats.max)} {spec.unit}
                  </div>
                )}
                <MetricChart spec={spec} points={series.points} stats={stats} height={64} compact className="mt-2" />
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
