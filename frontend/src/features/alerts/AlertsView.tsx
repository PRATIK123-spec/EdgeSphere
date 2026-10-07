import { useMemo, useState } from 'react'
import { Bell, ChevronLeft, ChevronRight, CircleCheck, Clock, FilterX, OctagonAlert, RotateCw, ShieldCheck, TriangleAlert } from 'lucide-react'

import { SegmentedControl } from '@/components/common/SegmentedControl'
import { StatTile } from '@/components/common/StatTile'
import { EmptyState, ErrorState } from '@/components/common/states'
import { StatusDot } from '@/components/common/StatusBadge'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import type { AlertQueryParams } from '@/features/alerts/api'
import { AlertList } from '@/features/alerts/AlertList'
import { useAlerts } from '@/features/alerts/hooks'
import { KNOWN_TYPES, alertTypeMeta } from '@/features/alerts/meta'
import { formatNumber } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { AlertStatus, DeviceResponse } from '@/types/api'

type StatusFilter = 'open' | AlertStatus | 'all'
type TimeWindow = '24h' | '7d' | '30d' | 'all'

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: 'open', label: 'Open' },
  { value: 'active', label: 'Active' },
  { value: 'acknowledged', label: 'Acknowledged' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'all', label: 'All' },
]
const SEVERITY_OPTIONS = [
  { value: 'ALL', label: 'All severities' },
  { value: 'CRITICAL', label: 'Critical' },
  { value: 'HIGH', label: 'High' },
]
const TYPE_OPTIONS = [
  { value: 'ALL', label: 'All types' },
  ...KNOWN_TYPES.map((t) => ({ value: t, label: alertTypeMeta(t).label })),
]
const TIME_WINDOWS: { value: TimeWindow; label: string; ms: number | null }[] = [
  { value: '24h', label: '24H', ms: 24 * 3_600_000 },
  { value: '7d', label: '7D', ms: 7 * 86_400_000 },
  { value: '30d', label: '30D', ms: 30 * 86_400_000 },
  { value: 'all', label: 'All', ms: null },
]
const PAGE_SIZE = 20
const OPEN: AlertStatus[] = ['active', 'acknowledged']

function statusParam(filter: StatusFilter): AlertStatus[] | undefined {
  if (filter === 'all') return undefined
  if (filter === 'open') return OPEN
  return [filter]
}

function ListSkeleton() {
  return (
    <div className="surface divide-y" aria-hidden="true">
      {Array.from({ length: 5 }, (_, i) => (
        <div key={i} className="flex gap-3 px-5 py-4">
          <Skeleton className="size-8 rounded-lg" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-3 w-72 max-w-full" />
          </div>
          <Skeleton className="h-3 w-16" />
        </div>
      ))}
    </div>
  )
}

/** Count of open alerts matching a severity (cheap: limit=1, uses X-Total-Count). */
function useOpenCount(deviceId: number | undefined, severity: string | null, status: AlertStatus[] = OPEN) {
  const query = useAlerts({ device_id: deviceId, severity: severity ? [severity] : undefined, status, limit: 1 })
  return query.data?.total
}

/**
 * Alert center backed by GET /alerts/ — every filter, the time window and
 * pagination are applied by the server. Fleet-wide unless `deviceId` is set.
 */
export function AlertsView({
  devices,
  deviceId,
  onDeviceChange,
}: {
  devices: DeviceResponse[]
  /** Restrict to one device (undefined = whole fleet). */
  deviceId?: number
  /** Provide to show a device filter (fleet page). */
  onDeviceChange?: (deviceId: number | undefined) => void
}) {
  const [status, setStatus] = useState<StatusFilter>('open')
  const [severity, setSeverity] = useState('ALL')
  const [type, setType] = useState('ALL')
  const [timeWindow, setTimeWindow] = useState<TimeWindow>('all')
  const [anchor, setAnchor] = useState(() => Date.now())
  const [page, setPage] = useState(0)

  const devicesById = useMemo(() => new Map(devices.map((d) => [d.id, d])), [devices])
  const windowMs = TIME_WINDOWS.find((w) => w.value === timeWindow)!.ms

  const params: AlertQueryParams = {
    device_id: deviceId,
    status: statusParam(status),
    severity: severity === 'ALL' ? undefined : [severity],
    alert_type: type === 'ALL' ? undefined : [type],
    since: windowMs ? new Date(anchor - windowMs).toISOString() : undefined,
    limit: PAGE_SIZE,
    offset: page * PAGE_SIZE,
  }
  const query = useAlerts(params)

  const openCritical = useOpenCount(deviceId, 'CRITICAL')
  const openHigh = useOpenCount(deviceId, 'HIGH')
  const acknowledged = useOpenCount(deviceId, null, ['acknowledged'])
  const allTime = useAlerts({ device_id: deviceId, limit: 1 }).data?.total

  const update = <T,>(setter: (v: T) => void) => (value: T) => {
    setter(value)
    setPage(0)
  }
  const clear = () => {
    setStatus('open')
    setSeverity('ALL')
    setType('ALL')
    setTimeWindow('all')
    setPage(0)
  }
  const filtersActive = status !== 'open' || severity !== 'ALL' || type !== 'ALL' || timeWindow !== 'all'

  const total = query.data?.total ?? 0
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const scope = deviceId !== undefined ? devicesById.get(deviceId)?.display_name ?? 'this device' : 'your fleet'

  return (
    <div className="space-y-5">
      <section aria-label="Alert summary" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          label="Open critical"
          icon={OctagonAlert}
          value={openCritical ?? '–'}
          accent={openCritical ? 'border-status-critical/30 bg-status-critical/10 text-status-critical' : undefined}
          hint="Temperature above 70 °C"
        />
        <StatTile
          label="Open high"
          icon={TriangleAlert}
          value={openHigh ?? '–'}
          accent={openHigh ? 'border-status-warning/30 bg-status-warning/10 text-status-warning' : undefined}
          hint="Battery, CPU or memory"
        />
        <StatTile label="Acknowledged" icon={CircleCheck} value={acknowledged ?? '–'} hint="Seen, not yet resolved" />
        <StatTile label="All-time" icon={Bell} value={allTime ?? '–'} hint={`Every alert for ${scope}`} />
      </section>

      <div className="flex flex-col gap-3 rounded-xl border bg-card/60 p-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          {onDeviceChange && (
            <Select
              value={deviceId !== undefined ? String(deviceId) : 'all'}
              onValueChange={(v) => {
                onDeviceChange(v === 'all' ? undefined : Number(v))
                setPage(0)
              }}
            >
              <SelectTrigger className="h-8 w-full sm:w-56" aria-label="Filter by device">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All devices</SelectItem>
                {devices.map((d) => (
                  <SelectItem key={d.id} value={String(d.id)}>
                    <span className="inline-flex min-w-0 items-center gap-2">
                      <StatusDot status={d.status} />
                      <span className="truncate">{d.display_name}</span>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <SegmentedControl label="Filter by status" value={status} onChange={update(setStatus)} options={STATUS_OPTIONS} className="flex-wrap" />
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          <SegmentedControl label="Filter by severity" value={severity} onChange={update(setSeverity)} options={SEVERITY_OPTIONS} />
          <SegmentedControl label="Filter by alert type" value={type} onChange={update(setType)} options={TYPE_OPTIONS} className="flex-wrap" />
          <SegmentedControl label="Filter by time" value={timeWindow} onChange={update(setTimeWindow)} options={TIME_WINDOWS} />
          <div className="flex items-center gap-2 sm:ml-auto">
            {filtersActive && (
              <Button variant="ghost" size="sm" onClick={clear}>
                <FilterX aria-hidden="true" /> Reset
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setAnchor(Date.now())
                void query.refetch()
              }}
              disabled={query.isFetching}
              aria-label="Refresh alerts"
            >
              <RotateCw className={cn(query.isFetching && 'animate-spin')} aria-hidden="true" />
              <span className="hidden sm:inline">Refresh</span>
            </Button>
          </div>
        </div>
      </div>

      {query.isPending ? (
        <ListSkeleton />
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      ) : total === 0 ? (
        allTime === 0 ? (
          <EmptyState
            icon={ShieldCheck}
            title={`No alerts for ${scope}`}
            description="Alerts are raised automatically when a telemetry reading crosses a threshold: temperature above 70 °C, battery below 20 %, or CPU or memory above 90 %."
          />
        ) : (
          <EmptyState
            icon={status === 'open' && !filtersActive ? ShieldCheck : FilterX}
            title={status === 'open' && !filtersActive ? 'No open alerts' : 'No alerts match these filters'}
            description={
              status === 'open' && !filtersActive
                ? 'Every alert has been resolved. Switch to “All” to see the history.'
                : 'Try a wider time window or a different status, severity or type.'
            }
            action={
              <Button variant="outline" size="sm" onClick={() => (filtersActive ? clear() : update(setStatus)('all'))}>
                {filtersActive ? 'Reset filters' : 'Show all alerts'}
              </Button>
            }
          />
        )
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
            <span role="status">
              <span className="tabular font-medium text-foreground">{formatNumber(total, 0)}</span>{' '}
              {total === 1 ? 'alert' : 'alerts'} · newest first · filtered on the server
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Clock className="size-3.5" aria-hidden="true" /> Updates live
            </span>
          </div>
          <div className={cn('transition-opacity', query.isPlaceholderData && 'opacity-60')}>
            <AlertList alerts={query.data.items} devices={deviceId === undefined ? devicesById : undefined} />
          </div>
          {pageCount > 1 && (
            <div className="flex items-center justify-between">
              <span className="tabular text-xs text-muted-foreground">
                Page {page + 1} of {pageCount}
              </span>
              <div className="flex gap-1.5">
                <Button variant="outline" size="sm" onClick={() => setPage(page - 1)} disabled={page === 0 || query.isFetching}>
                  <ChevronLeft aria-hidden="true" /> Newer
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(page + 1)}
                  disabled={page >= pageCount - 1 || query.isFetching}
                >
                  Older <ChevronRight aria-hidden="true" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
