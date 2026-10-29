import { useEffect, useRef, useState, type ReactNode } from 'react'
import { AlertOctagon, Hourglass, Inbox, Loader2, RotateCw, WifiOff, type LucideIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { LogoMark } from '@/components/common/Logo'
import { getErrorMessage, isColdStartError } from '@/lib/api-client'
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
      <div className="elevation-1 mb-4 flex size-12 items-center justify-center rounded-xl border bg-card">
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

const AUTO_RETRY_S = 15

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
  const browserOffline = typeof navigator !== 'undefined' && !navigator.onLine
  const coldStart = isColdStartError(error) && !browserOffline
  const Icon = browserOffline ? WifiOff : coldStart ? Hourglass : AlertOctagon
  const heading =
    title ?? (browserOffline ? 'You are offline' : coldStart ? 'The server is still waking up' : 'Something went wrong')
  const message = browserOffline
    ? 'Check your network connection, then try again.'
    : coldStart
      ? 'It sleeps when idle and can take up to a minute to respond. This retries on its own.'
      : getErrorMessage(error)

  return (
    <div
      role="alert"
      className={cn(
        'flex flex-col items-center justify-center rounded-xl border px-6 text-center',
        coldStart ? 'border-status-warning/30 bg-status-warning/5' : 'border-destructive/25 bg-destructive/5',
        compact ? 'py-8' : 'py-14',
        className,
      )}
    >
      <div
        className={cn(
          'mb-4 flex size-12 items-center justify-center rounded-xl border',
          coldStart ? 'border-status-warning/40 bg-status-warning/10' : 'border-destructive/30 bg-destructive/10',
        )}
      >
        <Icon className={cn('size-5', coldStart ? 'text-status-warning' : 'text-destructive')} aria-hidden="true" />
      </div>
      <h3 className="text-sm font-semibold">{heading}</h3>
      <p className="mt-1.5 max-w-md text-sm text-pretty text-muted-foreground">{message}</p>
      {onRetry &&
        (coldStart ? (
          <AutoRetryButton onRetry={onRetry} />
        ) : (
          <Button variant="outline" size="sm" className="mt-5" onClick={onRetry}>
            <RotateCw aria-hidden="true" />
            Try again
          </Button>
        ))}
    </div>
  )
}

/**
 * Cold starts usually finish within a minute, so retry on a timer as well as
 * on click. Callers pass inline callbacks; the latest is kept in a ref.
 */
function AutoRetryButton({ onRetry }: { onRetry: () => void }) {
  const retryRef = useRef(onRetry)
  useEffect(() => {
    retryRef.current = onRetry
  })
  const [startedAt] = useState(() => Date.now())
  const [now, setNow] = useState(startedAt)
  useEffect(() => {
    const tick = window.setInterval(() => setNow(Date.now()), 1_000)
    const retry = window.setInterval(() => retryRef.current(), AUTO_RETRY_S * 1_000)
    return () => {
      window.clearInterval(tick)
      window.clearInterval(retry)
    }
  }, [])
  const countdown = AUTO_RETRY_S - (Math.floor((now - startedAt) / 1000) % AUTO_RETRY_S)

  return (
    <Button variant="outline" size="sm" className="mt-5" onClick={onRetry}>
      <RotateCw aria-hidden="true" />
      Try again now <span className="font-mono tabular-nums text-muted-foreground">· auto in {countdown}s</span>
    </Button>
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
