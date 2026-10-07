import { STATUS_LABELS, severityMeta } from '@/features/alerts/meta'
import { cn } from '@/lib/utils'

/** Severity pill: icon + text label, never colour alone. */
export function SeverityBadge({ severity, className }: { severity: string; className?: string }) {
  const meta = severityMeta(severity)
  const Icon = meta.icon
  return (
    <span
      className={cn(
        'inline-flex h-6 items-center gap-1 rounded-md border px-2 text-[11px] font-semibold tracking-wide whitespace-nowrap uppercase',
        meta.badge,
        className,
      )}
    >
      <Icon className="size-3.5" aria-hidden="true" />
      {meta.label}
    </span>
  )
}

const STATUS_STYLES: Record<string, string> = {
  active: 'border-status-critical/30 text-foreground',
  acknowledged: 'border-status-warning/40 text-foreground',
  resolved: 'border-border text-muted-foreground',
}

/** Alert lifecycle state, as text with a shape cue (filled / ring / check). */
export function AlertStatusBadge({ status }: { status: string }) {
  return (
    <span
      className={cn(
        'inline-flex h-6 items-center gap-1.5 rounded-md border px-2 text-[11px] font-medium whitespace-nowrap',
        STATUS_STYLES[status] ?? 'border-border text-muted-foreground',
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          'inline-block size-2 rounded-full',
          status === 'active' && 'bg-status-critical',
          status === 'acknowledged' && 'border-2 border-status-warning',
          status === 'resolved' && 'bg-muted-foreground/50',
        )}
      />
      {STATUS_LABELS[status] ?? status}
    </span>
  )
}
