import type { ReactNode } from 'react'
import { AlertOctagon, Inbox, Loader2, RotateCw, WifiOff, type LucideIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { LogoMark } from '@/components/common/Logo'
import { getErrorMessage, isApiError } from '@/lib/api-client'
import { cn } from '@/lib/utils'

// ------------------------------------------------------------------ empty

export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
  className,
}: {
  icon?: LucideIcon
  title: string
  description?: ReactNode
  action?: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'bg-grid flex flex-col items-center justify-center rounded-xl border border-dashed px-6 py-14 text-center',
        className,
      )}
    >
      <div className="mb-4 flex size-12 items-center justify-center rounded-xl border bg-card shadow-sm">
        <Icon className="size-5 text-muted-foreground" aria-hidden="true" />
      </div>
      <h3 className="text-sm font-semibold">{title}</h3>
      {description && (
        <p className="mt-1.5 max-w-md text-sm text-pretty text-muted-foreground">{description}</p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

// ------------------------------------------------------------------ error

export function ErrorState({
  error,
  title,
  onRetry,
  className,
  compact = false,
}: {
  error: unknown
  title?: string
  onRetry?: () => void
  className?: string
  compact?: boolean
}) {
  const offline = isApiError(error) && error.status === 0
  const Icon = offline ? WifiOff : AlertOctagon
  const heading = title ?? (offline ? 'API unreachable' : 'Something went wrong')

  return (
    <div
      role="alert"
      className={cn(
        'flex flex-col items-center justify-center rounded-xl border border-destructive/25 bg-destructive/5 px-6 text-center',
        compact ? 'py-8' : 'py-14',
        className,
      )}
    >
      <div className="mb-4 flex size-12 items-center justify-center rounded-xl border border-destructive/30 bg-destructive/10">
        <Icon className="size-5 text-destructive" aria-hidden="true" />
      </div>
      <h3 className="text-sm font-semibold">{heading}</h3>
      <p className="mt-1.5 max-w-md text-sm text-pretty text-muted-foreground">
        {getErrorMessage(error)}
      </p>
      {onRetry && (
        <Button variant="outline" size="sm" className="mt-5" onClick={onRetry}>
          <RotateCw aria-hidden="true" />
          Try again
        </Button>
      )}
    </div>
  )
}

// ---------------------------------------------------------------- loading

export function FullPageLoader({ label = 'Loading EdgeSphere…' }: { label?: string }) {
  return (
    <div className="bg-grid flex min-h-svh flex-col items-center justify-center gap-4" role="status">
      <LogoMark className="size-10 animate-pulse" />
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        {label}
      </div>
    </div>
  )
}

export function StatTilesSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="surface p-4">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="mt-4 h-7 w-14" />
          <Skeleton className="mt-3 h-3 w-24" />
        </div>
      ))}
    </div>
  )
}

export function TableSkeleton({ rows = 6, columns = 5 }: { rows?: number; columns?: number }) {
  return (
    <div className="surface overflow-hidden" role="status" aria-label="Loading">
      <div className="flex gap-6 border-b px-4 py-3">
        {Array.from({ length: columns }, (_, i) => (
          <Skeleton key={i} className="h-3 flex-1" />
        ))}
      </div>
      {Array.from({ length: rows }, (_, r) => (
        <div key={r} className="flex items-center gap-6 border-b px-4 py-4 last:border-b-0">
          {Array.from({ length: columns }, (_, c) => (
            <Skeleton key={c} className={cn('h-4 flex-1', c === 0 && 'max-w-56')} />
          ))}
        </div>
      ))}
    </div>
  )
}

export function CardSkeleton({ className, lines = 3 }: { className?: string; lines?: number }) {
  return (
    <div className={cn('surface space-y-3 p-5', className)} aria-hidden="true">
      <Skeleton className="h-4 w-32" />
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton key={i} className="h-3" style={{ width: `${90 - i * 15}%` }} />
      ))}
    </div>
  )
}
