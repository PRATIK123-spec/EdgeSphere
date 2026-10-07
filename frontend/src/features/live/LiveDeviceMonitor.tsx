import { useMemo, useState, type ReactNode } from 'react'
import { Activity, AlertTriangle, Battery, Cpu, MemoryStick, Power, Radio, Thermometer, Wifi, type LucideIcon } from 'lucide-react'

import { EmptyState } from '@/components/common/states'
import { StatusBadge } from '@/components/common/StatusBadge'
import { TimeAgo } from '@/components/common/TimeAgo'
import { Skeleton } from '@/components/ui/skeleton'
import { RecentAlertsCard } from '@/features/alerts/RecentAlertsCard'
import { SeverityBadge } from '@/features/alerts/SeverityBadge'
import { alertTypeMeta } from '@/features/alerts/meta'
import { useRealtimeEvents, useRealtimeLive } from '@/features/realtime/realtime-context'
import { LIVE_POLL_MS, useLatestTelemetry, useRecentTelemetry } from '@/features/telemetry/hooks'
import { MetricChart } from '@/features/telemetry/MetricChart'
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
const FEED_LIMIT = 40

const timeFmt = new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' })

interface FeedItem {
  key: string
  at: number
  event: RealtimeEvent
}

function FeedRow({ item }: { item: FeedItem }) {
  const { event } = item
  let icon = <Activity className="size-3.5 text-muted-foreground" aria-hidden="true" />
  let body: ReactNode = null
  if (event.type === 'telemetry') {
    body = (
      <span className="tabular text-muted-foreground">
        Reading · {formatNumber(event.data.temperature)} °C · {event.data.battery}% · CPU {formatNumber(event.data.cpu_usage)}% · RAM{' '}
        {formatNumber(event.data.ram_usage)}%
      </span>
    )
  } else if (event.type === 'device.status') {
    const online = event.data.status === 'Online'
    icon = online ? (
      <Wifi className="size-3.5 text-status-online" aria-hidden="true" />
    ) : (
      <Power className="size-3.5 text-muted-foreground" aria-hidden="true" />
    )
    body = <span className="font-medium">Went {event.data.status.toLowerCase()}</span>
  } else if (event.type === 'alert.created' || event.type === 'alert.updated') {
    icon = <AlertTriangle className="size-3.5 text-status-warning" aria-hidden="true" />
    body = (
      <span className="inline-flex flex-wrap items-center gap-1.5">
        <SeverityBadge severity={event.data.severity} />
        <span className="font-medium">{alertTypeMeta(event.data.alert_type).label}</span>
        <span className="text-muted-foreground">
          {event.type === 'alert.created' ? event.data.message : `marked ${event.data.status}`}
        </span>
      </span>
    )
  }
  return (
    <li className="flex items-start gap-2.5 py-2 text-xs animate-in fade-in-0 slide-in-from-top-1" data-event-type={event.type}>
      <span className="mt-0.5">{icon}</span>
      <span className="min-w-0 flex-1">{body}</span>
      <time className="tabular shrink-0 text-muted-foreground" dateTime={new Date(item.at).toISOString()}>
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

  useRealtimeEvents((event) => {
    if (event.device_id !== device.id) return
    if (event.type === 'telemetry') setReceived((n) => n + 1)
    if (event.type.startsWith('device.') && event.type !== 'device.status') return
    setFeed((items) =>
      [{ key: `${event.type}-${event.ts}-${items.length}`, at: Date.now(), event }, ...items].slice(0, FEED_LIMIT),
    )
  })

  const readings = useMemo(() => toReadings(recent.data?.items ?? []), [recent.data])
  const series = useMemo(() => buildSeries(readings), [readings])
  const reading = latest.data
  const readingAt = parseApiDate(reading?.created_at)

  return (
    <div className="grid gap-6 xl:grid-cols-3">
      <div className="space-y-6 xl:col-span-2">
        <section className="surface p-5" aria-labelledby="live-readings-heading">
          <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 id="live-readings-heading" className="flex items-center gap-2 text-sm font-semibold">
                Live readings <StatusBadge status={device.status} />
              </h2>
              <p className="text-xs text-muted-foreground">
                {live
                  ? 'Pushed over the WebSocket the moment the device reports.'
                  : `Real-time unavailable — polling every ${LIVE_POLL_MS / 1000}s until it reconnects.`}
              </p>
            </div>
            <div className="text-right text-xs text-muted-foreground">
              {reading ? (
                <>
                  <div>
                    Last reading <TimeAgo value={reading.created_at} className="font-medium text-foreground" />
                  </div>
                  <div className="tabular">{readingAt ? timeFmt.format(readingAt) : ''}</div>
                </>
              ) : null}
              <div className="tabular mt-0.5">{received} received this session</div>
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
                      {breached && <AlertTriangle className="ml-auto size-3.5 text-status-critical" aria-label="Threshold breached" />}
                    </span>
                    {/* Re-keyed per reading so each update visibly flashes in. */}
                    <div key={reading.id} className="tabular mt-2 text-3xl font-semibold tracking-tight animate-in fade-in-0 zoom-in-95 duration-300">
                      {formatNumber(value)}
                      <span className="ml-1 text-sm font-normal text-muted-foreground">{metric.unit}</span>
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
          <h2 id="live-trend-heading" className="text-sm font-semibold">
            Rolling window
          </h2>
          <p className="mb-4 text-xs text-muted-foreground">Last {WINDOW} readings · new readings are appended live</p>
          {recent.isPending ? (
            <Skeleton className="h-48 w-full" />
          ) : readings.length === 0 ? (
            <p className="rounded-lg border border-dashed px-3 py-8 text-center text-sm text-muted-foreground">No readings yet.</p>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {METRICS.map((spec) => (
                <div key={spec.key}>
                  <div className="mb-1 text-xs font-medium text-muted-foreground">{spec.label}</div>
                  <MetricChart spec={spec} points={series.points} stats={metricStats(readings, spec.key)} height={130} />
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <div className="space-y-6">
        <section className="surface flex flex-col p-5" aria-labelledby="event-stream-heading">
          <h2 id="event-stream-heading" className="text-sm font-semibold">
            Event stream
          </h2>
          <p className="text-xs text-muted-foreground">Real-time events for this device since you opened the page</p>
          {feed.length === 0 ? (
            <p className="mt-4 rounded-lg border border-dashed px-3 py-6 text-center text-xs text-muted-foreground">
              {live ? 'Listening… events appear here as they happen.' : 'Waiting for the real-time connection.'}
            </p>
          ) : (
            <ol className="mt-2 max-h-96 divide-y overflow-y-auto pr-1" aria-label="Live events" aria-live="polite">
              {feed.map((item) => (
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
        />
      </div>
    </div>
  )
}
