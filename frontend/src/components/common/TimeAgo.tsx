import { useEffect, useState } from 'react'
import { formatDateTime, formatRelative } from '@/lib/format'
import type { ApiDateTime } from '@/types/api'

/** Relative timestamp that re-renders every 15s; full date on hover. */
export function TimeAgo({
  value,
  className,
  fallback = '—',
}: {
  value: ApiDateTime | null | undefined
  className?: string
  /** Shown when there is no timestamp (e.g. a device that never reported). */
  fallback?: string
}) {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 15_000)
    return () => window.clearInterval(timer)
  }, [])

  if (!value) return <span className={className}>{fallback}</span>

  return (
    <time dateTime={value} title={formatDateTime(value)} className={className}>
      {formatRelative(value, now)}
    </time>
  )
}
