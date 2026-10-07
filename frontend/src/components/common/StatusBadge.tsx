import { CircleHelp, Power, Wifi, Wrench } from 'lucide-react'
import { cn } from '@/lib/utils'
import { statusTone, type StatusTone } from '@/features/devices/status'
import type { DeviceStatus } from '@/types/api'

const toneStyles: Record<StatusTone, { dot: string; badge: string; Icon: typeof Wifi }> = {
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
  unknown: {
    dot: 'bg-muted-foreground',
    badge: 'border-border bg-muted/60 text-muted-foreground',
    Icon: CircleHelp,
  },
}

/** Pulsing dot for Online, solid dot otherwise. Decorative: pair with a text label. */
export function StatusDot({ status, className }: { status: DeviceStatus; className?: string }) {
  const tone = statusTone(status)
  const { dot } = toneStyles[tone]
  return (
    <span className={cn('relative inline-flex size-2 shrink-0', className)} aria-hidden="true">
      {tone === 'online' && (
        <span className={cn('absolute inset-0 rounded-full animate-pulse-ring', dot)} />
      )}
      <span className={cn('relative inline-flex size-2 rounded-full', dot)} />
    </span>
  )
}

/** Status pill: dot + icon + label, so state is never conveyed by colour alone. */
export function StatusBadge({
  status,
  className,
  showIcon = false,
}: {
  status: DeviceStatus
  className?: string
  showIcon?: boolean
}) {
  const tone = statusTone(status)
  const { badge, Icon } = toneStyles[tone]
  return (
    <span
      className={cn(
        'inline-flex h-6 items-center gap-1.5 rounded-full border px-2.5 text-xs font-medium whitespace-nowrap',
        badge,
        className,
      )}
    >
      <StatusDot status={status} />
      {showIcon && <Icon className="size-3 text-muted-foreground" aria-hidden="true" />}
      {status}
    </span>
  )
}
