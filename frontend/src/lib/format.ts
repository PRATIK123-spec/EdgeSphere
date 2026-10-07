import type { ApiDateTime } from '@/types/api'

/**
 * The backend stores naive UTC datetimes and serializes them without a
 * timezone suffix. Interpret them as UTC, not local time.
 */
export function parseApiDate(value: ApiDateTime | null | undefined): Date | null {
  if (!value) return null
  const hasZone = /([zZ]|[+-]\d{2}:?\d{2})$/.test(value)
  const date = new Date(hasZone ? value : `${value}Z`)
  return Number.isNaN(date.getTime()) ? null : date
}

const dateTimeFormat = new Intl.DateTimeFormat(undefined, {
  dateStyle: 'medium',
  timeStyle: 'medium',
})

const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: 'long' })

export function formatDateTime(value: ApiDateTime | null | undefined): string {
  const date = parseApiDate(value)
  return date ? dateTimeFormat.format(date) : '—'
}

export function formatDate(value: ApiDateTime | null | undefined): string {
  const date = parseApiDate(value)
  return date ? dateFormat.format(date) : '—'
}

const relativeFormat = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' })

export function formatRelative(value: ApiDateTime | null | undefined, now = Date.now()): string {
  const date = parseApiDate(value)
  if (!date) return '—'

  const seconds = Math.round((date.getTime() - now) / 1000)
  const abs = Math.abs(seconds)

  // Small future offsets come from client/server clock skew, not real future events.
  if (abs < 5 || (seconds > 0 && seconds < 120)) return 'just now'
  if (abs < 60) return relativeFormat.format(seconds, 'second')
  if (abs < 3600) return relativeFormat.format(Math.round(seconds / 60), 'minute')
  if (abs < 86_400) return relativeFormat.format(Math.round(seconds / 3600), 'hour')
  if (abs < 2_592_000) return relativeFormat.format(Math.round(seconds / 86_400), 'day')
  return dateFormat.format(date)
}

export function formatNumber(value: number, maximumFractionDigits = 1): string {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits }).format(value)
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  const first = parts[0]?.[0] ?? ''
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : ''
  return (first + last).toUpperCase()
}
