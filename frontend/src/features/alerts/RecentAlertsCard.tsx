import { useMemo, type ReactNode } from 'react'
import { Link } from 'react-router'
import { ArrowRight, ShieldCheck } from 'lucide-react'

import { ErrorState } from '@/components/common/states'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { AlertList } from '@/features/alerts/AlertList'
import { useAlerts } from '@/features/alerts/hooks'
import { cn } from '@/lib/utils'
import type { AlertStatus, DeviceResponse } from '@/types/api'

/**
 * Compact list of the newest alerts (GET /alerts/?limit=…), fleet-wide or
 * for one device. Kept fresh by real-time alert events, not polling.
 */
export function RecentAlertsCard({
  deviceId,
  devices,
  context,
  limit = 5,
  status,
  className,
}: {
  /** One device, or undefined for the whole fleet. */
  deviceId?: number
  /** Device list (fleet view) to label each alert with its device. */
  devices?: DeviceResponse[]
  context: ReactNode
  limit?: number
  status?: AlertStatus[]
  className?: string
}) {
  const query = useAlerts({ device_id: deviceId, status, limit })
  const devicesById = useMemo(() => (devices ? new Map(devices.map((d) => [d.id, d])) : undefined), [devices])
  const href = deviceId !== undefined ? `/alerts?device=${deviceId}` : '/alerts'
  const headingId = `recent-alerts-${deviceId ?? 'fleet'}`

  return (
    <section className={cn('surface flex flex-col p-5', className)} aria-labelledby={headingId}>
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 id={headingId} className="text-sm font-semibold">
            Recent alerts
          </h2>
          <p className="text-xs text-muted-foreground">{context}</p>
        </div>
        {query.data && query.data.total > 0 && (
          <span className="tabular shrink-0 rounded-full border px-2 py-0.5 text-[11px] text-muted-foreground">
            {query.data.total} {status ? 'open' : 'total'}
          </span>
        )}
      </div>

      <div className="flex-1">
        {query.isPending ? (
          <div className="space-y-3 py-2" aria-hidden="true">
            {Array.from({ length: 3 }, (_, i) => (
              <div key={i} className="flex gap-3">
                <Skeleton className="size-8 rounded-lg" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-full" />
                </div>
              </div>
            ))}
          </div>
        ) : query.isError ? (
          <ErrorState compact error={query.error} onRetry={() => void query.refetch()} />
        ) : query.data.items.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed px-3 py-6 text-center">
            <ShieldCheck className="size-5 text-status-online" aria-hidden="true" />
            <p className="text-sm font-medium">{status ? 'No open alerts' : 'No alerts'}</p>
            <p className="text-xs text-muted-foreground">No unresolved threshold breaches.</p>
          </div>
        ) : (
          <AlertList alerts={query.data.items} devices={devicesById} compact />
        )}
      </div>

      <Button asChild variant="outline" size="sm" className="mt-3 w-full">
        <Link to={href}>
          View all alerts <ArrowRight aria-hidden="true" />
        </Link>
      </Button>
    </section>
  )
}
