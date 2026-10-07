import { Link } from 'react-router'
import { BarChart3, LineChart } from 'lucide-react'

import { ErrorState } from '@/components/common/states'
import { TimeAgo } from '@/components/common/TimeAgo'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useDeviceAnalytics } from '@/features/analytics/hooks'
import { DeviceSelect } from '@/features/devices/DeviceSelect'
import { METRICS } from '@/features/telemetry/thresholds'
import { formatNumber } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { DeviceResponse } from '@/types/api'

/**
 * Dashboard card: pick one device and see its server-computed aggregates
 * (GET /analytics/device/{id}, cached, not polled), with links to the full
 * Telemetry and Analytics views. No fleet-wide figures are invented.
 */
export function DeviceInsightsCard({
  devices,
  current,
  onSelect,
}: {
  devices: DeviceResponse[]
  current: DeviceResponse
  onSelect: (deviceId: number) => void
}) {
  const analytics = useDeviceAnalytics(current.id)

  const rows = analytics.data
    ? [
        { spec: METRICS[0]!, value: analytics.data.average_temperature },
        { spec: METRICS[1]!, value: analytics.data.average_battery },
        { spec: METRICS[2]!, value: analytics.data.average_cpu },
        { spec: METRICS[3]!, value: analytics.data.average_ram },
      ]
    : []

  return (
    <section className="surface flex flex-col p-5" aria-labelledby="insights-heading">
      <div className="mb-4">
        <h2 id="insights-heading" className="text-sm font-semibold">
          Device insights
        </h2>
        <p className="text-xs text-muted-foreground">All-time averages for one device</p>
      </div>

      <DeviceSelect devices={devices} value={current.id} onChange={onSelect} className="sm:w-full" />

      <div className="mt-4 min-h-36 flex-1">
        {analytics.isPending ? (
          <div className="grid grid-cols-2 gap-2.5" aria-hidden="true">
            {METRICS.map((m) => (
              <Skeleton key={m.key} className="h-14" />
            ))}
          </div>
        ) : analytics.isError ? (
          <ErrorState compact error={analytics.error} onRetry={() => void analytics.refetch()} />
        ) : analytics.data === null ? (
          <p className="rounded-lg border border-dashed px-3 py-6 text-center text-sm text-muted-foreground">
            No telemetry from this device yet.
          </p>
        ) : (
          <>
            <dl className="grid grid-cols-2 gap-2.5">
              {rows.map(({ spec, value }) => (
                <div key={spec.key} className="rounded-lg border bg-background/40 px-3 py-2">
                  <dt className="text-[11px] text-muted-foreground">Avg {spec.label}</dt>
                  <dd className={cn('tabular text-base font-semibold', spec.breached(value) && 'text-status-critical')}>
                    {formatNumber(value, 1)}
                    <span className="ml-0.5 text-xs font-normal text-muted-foreground">{spec.unit}</span>
                  </dd>
                </div>
              ))}
            </dl>
            <p className="mt-2.5 text-xs text-muted-foreground">
              {formatNumber(analytics.data.records, 0)} readings
              {analytics.data.last_updated && (
                <>
                  {' '}
                  · last <TimeAgo value={analytics.data.last_updated} />
                </>
              )}
            </p>
          </>
        )}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <Button asChild variant="outline" size="sm">
          <Link to={`/telemetry?device=${current.id}`}>
            <LineChart aria-hidden="true" /> Telemetry
          </Link>
        </Button>
        <Button asChild variant="outline" size="sm">
          <Link to={`/analytics?device=${current.id}`}>
            <BarChart3 aria-hidden="true" /> Analytics
          </Link>
        </Button>
      </div>
    </section>
  )
}
