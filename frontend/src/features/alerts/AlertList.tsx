import { Link } from 'react-router'
import { Check, CheckCheck, Loader2 } from 'lucide-react'

import { TimeAgo } from '@/components/common/TimeAgo'
import { Button } from '@/components/ui/button'
import { useAlertAction } from '@/features/alerts/hooks'
import { alertTypeMeta, severityMeta } from '@/features/alerts/meta'
import { AlertStatusBadge, SeverityBadge } from '@/features/alerts/SeverityBadge'
import { formatDateTime } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { AlertResponse, DeviceResponse } from '@/types/api'

function AlertActions({ alert }: { alert: AlertResponse }) {
  const acknowledge = useAlertAction('acknowledge')
  const resolve = useAlertAction('resolve')
  if (alert.status === 'resolved') return null
  const busy = acknowledge.isPending || resolve.isPending

  return (
    <div className="flex gap-1.5">
      {alert.status === 'active' && (
        <Button
          variant="outline"
          size="xs"
          disabled={busy}
          onClick={() => acknowledge.mutate(alert.id)}
          aria-label={`Acknowledge alert ${alert.id}`}
        >
          {acknowledge.isPending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Check aria-hidden="true" />}
          Acknowledge
        </Button>
      )}
      <Button
        variant="outline"
        size="xs"
        disabled={busy}
        onClick={() => resolve.mutate(alert.id)}
        aria-label={`Resolve alert ${alert.id}`}
      >
        {resolve.isPending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <CheckCheck aria-hidden="true" />}
        Resolve
      </Button>
    </div>
  )
}

/** Alert rows: severity accent + badges, device, message, time, lifecycle actions. */
export function AlertList({
  alerts,
  devices,
  compact = false,
  actions = !compact,
}: {
  alerts: AlertResponse[]
  /** Pass to show which device each alert belongs to (fleet views). */
  devices?: Map<number, DeviceResponse>
  compact?: boolean
  actions?: boolean
}) {
  return (
    <ul className={cn('divide-y', !compact && 'surface overflow-hidden')}>
      {alerts.map((alert) => {
        const type = alertTypeMeta(alert.alert_type)
        const TypeIcon = type.icon
        const device = devices?.get(alert.device_id)
        return (
          <li
            key={alert.id}
            className={cn(
              'relative flex gap-3',
              compact ? 'py-3' : 'px-4 py-3.5 sm:px-5',
              alert.status === 'resolved' && 'opacity-75',
            )}
            data-severity={alert.severity}
            data-alert-id={alert.id}
            data-status={alert.status}
          >
            {!compact && (
              <span
                aria-hidden="true"
                className={cn(
                  'absolute top-3 bottom-3 left-0 w-0.5 rounded-r-full',
                  alert.status === 'resolved' ? 'bg-border' : severityMeta(alert.severity).accent,
                )}
              />
            )}
            <div
              className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg border bg-muted/50"
              aria-hidden="true"
            >
              <TypeIcon className="size-4 text-muted-foreground" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <SeverityBadge severity={alert.severity} />
                <span className="text-sm font-medium">{type.label}</span>
                {!compact && <AlertStatusBadge status={alert.status} />}
                {!compact && <span className="font-mono text-[11px] text-muted-foreground">#{alert.id}</span>}
              </div>
              <p className="mt-1 text-sm text-pretty text-muted-foreground">{alert.message}</p>
              {device && (
                <Link
                  to={`/devices/${device.id}`}
                  className="mt-1 inline-block max-w-full truncate text-xs text-foreground/80 underline-offset-4 hover:underline"
                >
                  {device.display_name}
                </Link>
              )}
              {actions && alert.status !== 'resolved' && (
                <div className="mt-2.5">
                  <AlertActions alert={alert} />
                </div>
              )}
            </div>
            <div className="shrink-0 text-right text-xs text-muted-foreground">
              <TimeAgo value={alert.created_at} className="block font-medium text-foreground/80" />
              {!compact && <span className="mt-0.5 hidden sm:block">{formatDateTime(alert.created_at)}</span>}
              {!compact && alert.resolved_at && (
                <span className="mt-0.5 hidden sm:block">
                  Resolved <TimeAgo value={alert.resolved_at} />
                </span>
              )}
              {!compact && !alert.resolved_at && alert.acknowledged_at && (
                <span className="mt-0.5 hidden sm:block">
                  Ack&apos;d <TimeAgo value={alert.acknowledged_at} />
                </span>
              )}
            </div>
          </li>
        )
      })}
    </ul>
  )
}
