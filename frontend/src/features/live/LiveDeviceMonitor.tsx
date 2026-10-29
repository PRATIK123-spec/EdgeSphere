import { useMemo, useState, type ReactNode } from 'react'
import { AlertTriangle, Battery, Cpu, MemoryStick, Pause, Play, Radio, Thermometer, type LucideIcon } from 'lucide-react'

import { SegmentedControl } from '@/components/common/SegmentedControl'
import { EmptyState } from '@/components/common/states'
import { StatusBadge } from '@/components/common/StatusBadge'
import { TimeAgo } from '@/components/common/TimeAgo'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { RecentAlertsCard } from '@/features/alerts/RecentAlertsCard'
import { SeverityBadge } from '@/features/alerts/SeverityBadge'
import { STATUS_LABELS, alertTypeMeta, severityMeta } from '@/features/alerts/meta'
import { useRealtimeEvents, useRealtimeLive } from '@/features/realtime/realtime-context'
import { LIVE_POLL_MS, useLatestTelemetry, useRecentTelemetry } from '@/features/telemetry/hooks'
import { MetricChart, MetricChartLegend } from '@/features/telemetry/MetricChart'
import { buildSeries, metricStats, toReadings } from '@/features/telemetry/series'
import { METRICS, type MetricKey } from '@/features/telemetry/thresholds'
import { formatNumber, parseApiDate } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { DeviceResponse, RealtimeEvent } from '@/types/api'

const ICONS: Record<MetricKey, LucideIcon> = {
  temperature: Thermometer,
  battery: Battery,
  cpu_usage: Cpu,
  ram_usage: MemoryStick,
}
const WINDOW = 60
const FEED_LIMIT = 50

const timeFmt = new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' })

type FeedFilter = 'all' | 'changes'
const FEED_FILTERS: { value: FeedFilter; label: string }[] = [
  { value: 'all', label: 'All events' },
  { value: 'changes', label: 'Alerts & status' },
]

interface FeedItem {
  key: string
  at: number
  event: RealtimeEvent
}

function Tag({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex w-16 shrink-0 justify-center rounded border px-1 py-0.5 font-mono text-[10px] font-semibold tracking-wide',
        className,
      )}
    >
      {children}
    </span>
  )
}

/** One stream row: fixed-width type tag, body, time — scannable down the left edge. */
function FeedRow({ item }: { item: FeedItem }) {
  const { event } = item
  let tag: ReactNode = null
  let body: ReactNode = null
  let accent = 'bg-transparent'

  if (event.type === 'telemetry') {
    tag = <Tag className="text-muted-foreground">READING</Tag>
    body = (
      <span className="grid grid-cols-2 gap-x-3 gap-y-0.5 font-mono tabular-nums sm:grid-cols-4">
        {METRICS.map((m) => {
          const value = event.data[m.key]
          return (
            <span key={m.key} className={cn(m.breached(value) ? 'font-semibold text-status-critical' : 'text-foreground/90')}>
              <span className="font-sans text-muted-foreground">{m.short} </span>
              {formatNumber(value)}
              {m.unit === '%' ? '%' : '°'}
            </span>
          )
        })}
      </span>
    )
  } else if (event.type === 'device.status') {
    const online = event.data.status === 'Online'
    accent = online ? 'bg-status-online' : 'bg-status-offline'
    tag = (
      <Tag className={online ? 'border-status-online/40 text-foreground' : 'text-muted-foreground'}>STATUS</Tag>
    )
    body = <span className="font-medium">Device went {event.data.status.toLowerCase()}</span>
  } else if (event.type === 'alert.created' || event.type === 'alert.updated') {
    const created = event.type === 'alert.created'
    accent = event.data.status === 'resolved' ? 'bg-border' : severityMeta(event.data.severity).accent
    tag = <Tag className="border-status-critical/40 text-foreground">{created ? 'ALERT' : 'UPDATE'}</Tag>
    body = (
      <span className="inline-flex flex-wrap items-center gap-1.5">
        <SeverityBadge severity={event.data.severity} />
        <span className="font-medium">{alertTypeMeta(event.data.alert_type).label}</span>
        <span className="text-muted-foreground">
          {created ? event.data.message : `marked ${(STATUS_LABELS[event.data.status] ?? event.data.status).toLowerCase()}`}
        </span>
      </span>
    )
  }

  return (
    <li className="relative flex items-start gap-3 py-2.5 pl-3 text-xs" data-event-type={event.type}>
      <span className={cn('absolute top-2 bottom-2 left-0 w-0.5 rounded-full', accent)} aria-hidden="true" />
      {tag}
      <span className="min-w-0 flex-1 pt-px">{body}</span>
      <time className="shrink-0 pt-px font-mono text-[11px] text-muted-foreground tabular-nums" dateTime={new Date(item.at).toISOString()}>
        {timeFmt.format(item.at)}
      </time>
    </li>
  )
}

/** Live view of one device. Mount with `key={device.id}` so state resets per device. */
export function LiveDeviceMonitor({ device }: { device: DeviceResponse }) {
  const live = useRealtimeLive()
  const latest = useLatestTelemetry(device.id)
  const recent = useRecentTelemetry(device.id, WINDOW)
  const [feed, setFeed] = useState<FeedItem[]>([])
  const [received, setReceived] = useState(0)
  const [filter, setFilter] = useState<FeedFilter>('all')
  // While paused the visible list is frozen; new events keep arriving underneath.
  const [frozen, setFrozen] = useState<FeedItem[] | null>(null)

  useRealtimeEvents((event) => {
    if (event.device_id !== device.id) return
    if (event.type === 'telemetry') setReceived((n) => n + 1)
    if (event.type.startsWith('device.') && event.type !== 'device.status') return
    setFeed((items) =>
      [{ key: `${event.type}-${event.ts}-${Date.now()}-${items.length}`, at: Date.now(), event }, ...items].slice(
        0,
        FEED_LIMIT,
      ),
    )
  })

  const shown = (frozen ?? feed).filter((item) => filter === 'all' || item.event.type !== 'telemetry')
  const newWhilePaused = frozen ? feed.filter((item) => !frozen.includes(item)).length : 0

  const readings = useMemo(() => toReadings(recent.data?.items ?? []), [recent.data])
  const series = useMemo(() => buildSeries(readings), [readings])
  const reading = latest.data
  const readingAt = parseApiDate(reading?.created_at)

  return (
    <div className="grid gap-6 xl:grid-cols-3">
      <div className="min-w-0 space-y-6 xl:col-span-2">
        <section className="surface p-5" aria-labelledby="live-readings-heading">
          <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 id="live-readings-heading" className="flex items-center gap-2 text-sm font-semibold">
                Live readings <StatusBadge status={device.status} />
              </h2>
              <p className="text-xs text-muted-foreground">
                {live
                  ? 'Updated the moment the device reports.'
                  : `Refreshing every ${LIVE_POLL_MS / 1000}s until the live connection returns.`}
              </p>
            </div>
            <div className="text-xs text-muted-foreground sm:text-right">
              {reading && (
                <div>
                  Last reading <TimeAgo value={reading.created_at} className="font-medium text-foreground" />
                  {readingAt && <span className="ml-1.5 font-mono tabular-nums">{timeFmt.format(readingAt)}</span>}
                </div>
              )}
              <div className="mt-0.5 tabular-nums">{received} received since you opened this page</div>
            </div>
          </div>

          {latest.isPending ? (
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-hidden="true">
              {METRICS.map((m) => (
                <Skeleton key={m.key} className="h-24" />
              ))}
            </div>
          ) : !reading ? (
            <EmptyState
              icon={Radio}
              title="Waiting for the first reading"
              description="This device has not reported yet. Readings appear here the instant it posts telemetry with its device key."
            />
          ) : (
            <ul className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-live="polite" aria-atomic="false">
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
                    data-metric={metric.key}
                  >
                    <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                      <Icon className="size-3.5" aria-hidden="true" />
                      {metric.label}
                      {breached && (
                        <AlertTriangle className="ml-auto size-3.5 text-status-critical" aria-label="Threshold breached" />
                      )}
                    </span>
                    {/* Re-keyed per reading so each update visibly flashes in. */}
                    <div key={reading.id} className="text-metric mt-2 animate-in duration-300 fade-in-0 zoom-in-95">
                      {formatNumber(value)}
                      <span className="ml-1 font-sans text-sm font-normal text-muted-foreground">{metric.unit}</span>
                    </div>
                    <div className={cn('mt-1 text-[11px]', breached ? 'text-status-critical' : 'text-muted-foreground')}>
                      {breached ? 'Outside alert threshold' : metric.ruleLabel}
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </section>

        <section className="surface p-5" aria-labelledby="live-trend-heading">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 id="live-trend-heading" className="text-sm font-semibold">
                Rolling window
              </h2>
              <p className="text-xs text-muted-foreground">Last {WINDOW} readings; new readings are added as they arrive</p>
            </div>
            <MetricChartLegend />
          </div>
          {recent.isPending ? (
            <Skeleton className="h-48 w-full" />
          ) : readings.length === 0 ? (
            <p className="rounded-lg border border-dashed px-3 py-8 text-center text-sm text-muted-foreground">
              No readings yet.
            </p>
          ) : (
            <div className="grid gap-x-6 gap-y-5 md:grid-cols-2">
              {METRICS.map((spec) => (
                <div key={spec.key}>
                  <div className="mb-1 text-xs font-medium text-muted-foreground">{spec.label}</div>
                  <MetricChart spec={spec} points={series.points} stats={metricStats(readings, spec.key)} height={140} />
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <div className="min-w-0 space-y-6">
        <section className="surface flex flex-col p-5" aria-labelledby="event-stream-heading">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 id="event-stream-heading" className="text-sm font-semibold">
                Event stream
              </h2>
              <p className="text-xs text-muted-foreground">This device, newest first, since you opened the page</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setFrozen(frozen ? null : feed)}
              aria-pressed={frozen !== null}
            >
              {frozen ? <Play aria-hidden="true" /> : <Pause aria-hidden="true" />}
              {frozen ? 'Resume' : 'Pause'}
            </Button>
          </div>

          <SegmentedControl
            label="Filter events"
            value={filter}
            onChange={setFilter}
            options={FEED_FILTERS}
            className="mt-3 w-full"
          />

          {frozen && (
            <button
              type="button"
              onClick={() => setFrozen(null)}
              className="mt-3 rounded-lg border border-primary/30 bg-primary/10 px-3 py-2 text-left text-xs font-medium focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:outline-none"
            >
              Paused. {newWhilePaused} new {newWhilePaused === 1 ? 'event' : 'events'} waiting; resume to show them.
            </button>
          )}

          {shown.length === 0 ? (
            <p className="mt-4 rounded-lg border border-dashed px-3 py-6 text-center text-xs text-muted-foreground">
              {!live
                ? 'Events appear once the live connection is back.'
                : filter === 'changes'
                  ? 'No alerts or status changes yet.'
                  : 'Listening. Events appear here as they happen.'}
            </p>
          ) : (
            <ol className="mt-2 max-h-[28rem] divide-y overflow-y-auto pr-1" aria-label="Live events" aria-live={frozen ? 'off' : 'polite'}>
              {shown.map((item) => (
                <FeedRow key={item.key} item={item} />
              ))}
            </ol>
          )}
        </section>

        <RecentAlertsCard
          deviceId={device.id}
          status={['active', 'acknowledged']}
          limit={4}
          context="Unresolved alerts for this device"
          actions
        />
      </div>
    </div>
  )
}
