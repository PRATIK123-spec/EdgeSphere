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
}: {
  label: string
  value: ReactNode
  icon: LucideIcon
  hint?: ReactNode
  /** Tailwind classes for the icon chip, e.g. status colour. */
  accent?: string
  className?: string
}) {
  return (
    <div className={cn('surface relative overflow-hidden p-4', className)}>
      <div className="flex items-start justify-between gap-3">
        <span className="font-mono text-[11px] font-medium tracking-[0.12em] text-muted-foreground uppercase">
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
      <div className="tabular mt-2 text-3xl font-semibold tracking-tight">{value}</div>
      {hint && <div className="mt-1.5 text-xs text-muted-foreground">{hint}</div>}
    </div>
  )
}
