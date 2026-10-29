import { AlertTriangle, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { METRICS, type MetricSpec } from '@/features/telemetry/thresholds'
import { formatNumber, parseApiDate } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { TelemetryResponse } from '@/types/api'

const timeFmt = new Intl.DateTimeFormat(undefined, { timeStyle: 'medium' })
const dateFmt = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' })

function Value({ spec, value }: { spec: MetricSpec; value: number }) {
  const breached = spec.breached(value)
  return (
    <span
      className={cn(
        'inline-flex items-center justify-end gap-1 font-mono text-[13px] tabular-nums',
        breached && 'font-semibold text-status-critical',
      )}
    >
      {breached && <AlertTriangle className="size-3" aria-label="Outside alert threshold" />}
      {formatNumber(value)}
      <span className="hidden font-sans text-xs font-normal text-muted-foreground sm:inline">{spec.unit}</span>
    </span>
  )
}

/**
 * One server-side page of raw readings (GET /telemetry/{id}?limit&offset),
 * newest first. Pagination controls request other pages from the API.
 */
export function TelemetryTable({
  rows,
  total,
  page,
  pageSize,
  onPageChange,
  loading = false,
}: {
  rows: TelemetryResponse[]
  total: number
  page: number
  pageSize: number
  onPageChange: (page: number) => void
  loading?: boolean
}) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize))
  const first = total === 0 ? 0 : page * pageSize + 1
  const last = page * pageSize + rows.length

  return (
    <section className="surface overflow-hidden" aria-labelledby="readings-heading" aria-busy={loading}>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3">
        <div>
          <h2 id="readings-heading" className="text-sm font-semibold">
            Raw readings
          </h2>
          <p className="text-xs text-muted-foreground">Every telemetry record in range, newest first</p>
        </div>
        <span className="tabular inline-flex items-center gap-2 text-xs text-muted-foreground">
          {loading && <Loader2 className="size-3 animate-spin" aria-hidden="true" />}
          {first}–{last} of {formatNumber(total, 0)}
        </span>
      </div>

      <div className={cn('overflow-x-auto transition-opacity', loading && 'opacity-60')}>
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="pl-4">Time</TableHead>
              {METRICS.map((m) => (
                <TableHead key={m.key} className="px-1.5 text-right last:pr-4 sm:px-2">
                  <span className="sm:hidden">
                    {m.short} <span className="font-normal text-muted-foreground">{m.unit}</span>
                  </span>
                  <span className="hidden sm:inline">{m.label}</span>
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => {
              const date = parseApiDate(r.created_at)
              const breached = METRICS.some((m) => m.breached(r[m.key]))
              return (
                <TableRow key={r.id} className={cn(breached && 'bg-status-critical/5')}>
                  <TableCell className="pl-4 whitespace-nowrap">
                    <time dateTime={date?.toISOString()} className="block leading-tight tabular-nums">
                      <span className="text-sm">{date ? timeFmt.format(date) : '—'}</span>
                      <span className="block text-xs text-muted-foreground">{date ? dateFmt.format(date) : ''}</span>
                    </time>
                  </TableCell>
                  {METRICS.map((m) => (
                    <TableCell key={m.key} className="px-1.5 text-right last:pr-4 sm:px-2">
                      <Value spec={m} value={r[m.key]} />
                    </TableCell>
                  ))}
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>

      {pageCount > 1 && (
        <div className="flex items-center justify-between gap-2 border-t px-4 py-2.5">
          <span className="tabular text-xs text-muted-foreground">
            Page {page + 1} of {formatNumber(pageCount, 0)}
          </span>
          <div className="flex gap-1.5">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(page - 1)}
              disabled={page === 0 || loading}
              aria-label="Newer readings"
            >
              <ChevronLeft aria-hidden="true" /> Newer
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(page + 1)}
              disabled={page >= pageCount - 1 || loading}
              aria-label="Older readings"
            >
              Older <ChevronRight aria-hidden="true" />
            </Button>
          </div>
        </div>
      )}
    </section>
  )
}
