import { useMemo, useState } from 'react'
import { Activity, Clock, Layers, RotateCw } from 'lucide-react'

import { SegmentedControl } from '@/components/common/SegmentedControl'
import { CardSkeleton, EmptyState, ErrorState } from '@/components/common/states'
import { TimeAgo } from '@/components/common/TimeAgo'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useLatestTelemetry, useTelemetryPage, useTelemetrySeries } from '@/features/telemetry/hooks'
import { MetricChart } from '@/features/telemetry/MetricChart'
import { TIME_RANGES, formatBucket, fromServerSeries, seriesStats, type TimeRange } from '@/features/telemetry/series'
import { TelemetryTable } from '@/features/telemetry/TelemetryTable'
import { METRICS } from '@/features/telemetry/thresholds'
import { formatNumber, parseApiDate } from '@/lib/format'
import { cn } from '@/lib/utils'

const PAGE_SIZE = 25
/** Charts never request more than this many points; the server aggregates. */
const MAX_CHART_POINTS = 300

function HistorySkeleton() {
  return (
    <div className="space-y-6" aria-hidden="true">
      <div className="grid gap-4 md:grid-cols-2">
        {METRICS.map((m) => (
          <div key={m.key} className="surface p-4">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="mt-2 h-3 w-40" />
            <Skeleton className="mt-4 h-[180px] w-full" />
          </div>
        ))}
      </div>
      <CardSkeleton lines={6} />
    </div>
  )
}

/**
 * Telemetry history for one device, entirely server-side:
 * - charts: GET /telemetry/{id}/series (≤ 300 aggregated buckets for the range)
 * - table:  GET /telemetry/{id}?limit=25&offset=… within the same range
 * Nothing is polled; "Refresh" re-anchors the time range to now.
 */
export function TelemetryHistoryView({ deviceId }: { deviceId: number }) {
  const [rangeKey, setRangeKey] = useState<TimeRange>('all')
  const [anchor, setAnchor] = useState(() => Date.now())
  const [page, setPage] = useState(0)

  const range = TIME_RANGES.find((r) => r.value === rangeKey)!
  const since = range.ms ? new Date(anchor - range.ms).toISOString() : undefined
  const until = new Date(anchor).toISOString()

  const seriesQuery = useTelemetrySeries(deviceId, { key: rangeKey, ms: range.ms }, anchor, MAX_CHART_POINTS)
  const pageQuery = useTelemetryPage(deviceId, { limit: PAGE_SIZE, offset: page * PAGE_SIZE, since, until })
  const latest = useLatestTelemetry(deviceId)

  const series = seriesQuery.data
  const chart = useMemo(() => (series ? fromServerSeries(series) : null), [series])

  const refresh = () => {
    setPage(0)
    setAnchor(Date.now())
  }
  const changeRange = (value: TimeRange) => {
    setRangeKey(value)
    setPage(0)
  }

  // Readings newer than the loaded window exist (seen via the live/polled latest reading).
  const latestAt = parseApiDate(latest.data?.created_at)?.getTime() ?? 0
  const hasNewer = latestAt > anchor

  if (seriesQuery.isPending) return <HistorySkeleton />
  if (seriesQuery.isError) return <ErrorState error={seriesQuery.error} onRetry={() => void seriesQuery.refetch()} />

  if (latest.data === null && series!.readings === 0) {
    return (
      <EmptyState
        icon={Activity}
        title="No telemetry recorded yet"
        description="This device has never reported. Charts and readings appear once it posts telemetry to POST /telemetry/ with its device key."
        action={
          <Button variant="outline" size="sm" onClick={refresh}>
            <RotateCw aria-hidden="true" /> Check again
          </Button>
        }
      />
    )
  }

  const fetching = seriesQuery.isFetching || pageQuery.isFetching

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <Layers className="size-3.5" aria-hidden="true" />
            <span className="tabular font-medium text-foreground">{formatNumber(series!.readings, 0)}</span>
            {series!.readings === 1 ? 'reading' : 'readings'} in range
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Clock className="size-3.5" aria-hidden="true" />
            Loaded <TimeAgo value={new Date(anchor).toISOString()} />
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <SegmentedControl label="Time range" value={rangeKey} onChange={changeRange} options={TIME_RANGES} />
          <Button
            variant={hasNewer ? 'default' : 'outline'}
            size="sm"
            onClick={refresh}
            disabled={fetching}
            aria-label={hasNewer ? 'New readings available — refresh' : 'Refresh telemetry history'}
          >
            <RotateCw className={cn(fetching && 'animate-spin')} aria-hidden="true" />
            <span className="hidden sm:inline">{hasNewer ? 'New readings' : 'Refresh'}</span>
          </Button>
        </div>
      </div>

      {series!.readings === 0 ? (
        <EmptyState
          icon={Clock}
          title={`No readings in the last ${range.label.toLowerCase()}`}
          description={
            latest.data ? (
              <>
                The most recent reading was <TimeAgo value={latest.data.created_at} />.
              </>
            ) : undefined
          }
          action={
            <Button variant="outline" size="sm" onClick={() => changeRange('all')}>
              Show all readings
            </Button>
          }
        />
      ) : (
        <>
          {chart?.aggregated && chart.bucketMs && (
            <p className="rounded-lg border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
              {formatNumber(series!.readings, 0)} readings are averaged on the server into{' '}
              {formatBucket(chart.bucketMs)} intervals for the charts (hover a point for its min–max). The table
              below lists every raw reading.
            </p>
          )}

          <div className={cn('grid gap-4 transition-opacity md:grid-cols-2', seriesQuery.isPlaceholderData && 'opacity-60')}>
            {METRICS.map((spec) => {
              const stats = seriesStats(series!, spec.key)
              return (
                <section key={spec.key} className="surface p-4" aria-labelledby={`chart-${spec.key}`}>
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div>
                      <h3 id={`chart-${spec.key}`} className="text-sm font-semibold">
                        {spec.label}
                      </h3>
                      <p className="text-xs text-muted-foreground">{spec.ruleLabel}</p>
                    </div>
                    {stats && (
                      <dl className="tabular grid grid-cols-3 gap-3 text-right text-xs">
                        <div>
                          <dt className="text-muted-foreground">Min</dt>
                          <dd className="font-medium">{formatNumber(stats.min)}</dd>
                        </div>
                        <div>
                          <dt className="text-muted-foreground">Max</dt>
                          <dd className={cn('font-medium', spec.breached(stats.max) && 'text-status-critical')}>
                            {formatNumber(stats.max)}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-muted-foreground">Mean</dt>
                          <dd className="font-semibold">
                            {formatNumber(stats.mean)}
                            <span className="ml-0.5 font-normal text-muted-foreground">{spec.unit}</span>
                          </dd>
                        </div>
                      </dl>
                    )}
                  </div>
                  <MetricChart spec={spec} points={chart?.points ?? []} stats={stats} />
                </section>
              )
            })}
          </div>

          {series!.readings < 3 && (
            <p className="text-center text-xs text-muted-foreground">
              Only {series!.readings} {series!.readings === 1 ? 'reading is' : 'readings are'} in this range, so
              trends will fill in as the device keeps reporting.
            </p>
          )}

          {pageQuery.isError ? (
            <ErrorState compact error={pageQuery.error} onRetry={() => void pageQuery.refetch()} />
          ) : pageQuery.data ? (
            <TelemetryTable
              rows={pageQuery.data.items}
              total={pageQuery.data.total}
              page={page}
              pageSize={PAGE_SIZE}
              onPageChange={setPage}
              loading={pageQuery.isFetching}
            />
          ) : (
            <CardSkeleton lines={6} />
          )}
        </>
      )}
    </div>
  )
}
