import { AlertOctagon, CircleHelp, Power, Wifi, Wrench } from 'lucide-react'
import { cn } from '@/lib/utils'
import { statusTone, type StatusTone } from '@/features/devices/status'
import type { DeviceStatus } from '@/types/api'

/** Device statuses plus `critical`, reserved for alert-severity badges. */
type BadgeTone = StatusTone | 'critical'

const toneStyles: Record<BadgeTone, { dot: string; badge: string; Icon: typeof Wifi }> = {
  online: {
    dot: 'bg-status-online',
    badge: 'border-status-online/30 bg-status-online/10 text-foreground',
    Icon: Wifi,
  },
  offline: {
    dot: 'bg-status-offline',
    badge: 'border-border bg-muted/60 text-muted-foreground',
    Icon: Power,
  },
  warning: {
    dot: 'bg-status-warning',
    badge: 'border-status-warning/30 bg-status-warning/10 text-foreground',
    Icon: Wrench,
  },
  critical: {
    dot: 'bg-status-critical',
    badge: 'border-status-critical/30 bg-status-critical/10 text-foreground',
    Icon: AlertOctagon,
  },
  unknown: {
    dot: 'bg-muted-foreground',
    badge: 'border-border bg-muted/60 text-muted-foreground',
    Icon: CircleHelp,
  },
}

/** Pulsing dot for Online, solid dot otherwise. Decorative: pair with a text label. */
export function StatusDot({
  status,
  tone,
  className,
}: {
  status: DeviceStatus
  tone?: BadgeTone
  className?: string
}) {
  const resolved = tone ?? statusTone(status)
  const { dot } = toneStyles[resolved]
  return (
    <span className={cn('relative inline-flex size-2 shrink-0', className)} aria-hidden="true">
      {resolved === 'online' && (
        <span className={cn('absolute inset-0 rounded-full animate-pulse-ring', dot)} />
      )}
      <span className={cn('relative inline-flex size-2 rounded-full', dot)} />
    </span>
  )
}

/** Status pill: dot + icon + label, so state is never conveyed by colour alone. */
export function StatusBadge({
  status,
  tone,
  className,
  showIcon = false,
}: {
  status: DeviceStatus
  /** Override the derived tone, e.g. `critical` for an alert-severity badge. */
  tone?: BadgeTone
  className?: string
  showIcon?: boolean
}) {
  const resolved = tone ?? statusTone(status)
  const { badge, Icon } = toneStyles[resolved]
  return (
    <span
      className={cn(
        'inline-flex h-6 items-center gap-1.5 rounded-full border px-2.5 text-xs font-medium whitespace-nowrap',
        badge,
        className,
      )}
    >
      <StatusDot status={status} tone={tone} />
      {showIcon && <Icon className="size-3 text-muted-foreground" aria-hidden="true" />}
      {status}
    </span>
  )
}
