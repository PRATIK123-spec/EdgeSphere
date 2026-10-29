import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

export function StatTile({
  label,
  value,
  icon: Icon,
  hint,
  accent,
  className,
  children,
}: {
  label: string
  value: ReactNode
  icon: LucideIcon
  hint?: ReactNode
  /** Tailwind classes for the icon chip, e.g. status colour. */
  accent?: string
  className?: string
  /** Extra content under the hint, e.g. a meter. */
  children?: ReactNode
}) {
  return (
    <div className={cn('surface relative overflow-hidden p-4', className)}>
      <div className="flex items-start justify-between gap-3">
        <span className="text-channel-label">
          {label}
        </span>
        <span
          className={cn(
            'flex size-7 items-center justify-center rounded-md border bg-muted/50 text-muted-foreground',
            accent,
          )}
        >
          <Icon className="size-3.5" aria-hidden="true" />
        </span>
      </div>
      <div className="text-metric mt-2">{value}</div>
      {hint && <div className="mt-1.5 text-xs text-muted-foreground">{hint}</div>}
      {children}
    </div>
  )
}
