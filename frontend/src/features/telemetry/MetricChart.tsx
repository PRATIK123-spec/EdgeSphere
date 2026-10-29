import { useId } from 'react'
import { TriangleAlert } from 'lucide-react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import { formatNumber } from '@/lib/format'
import type { MetricSpec } from '@/features/telemetry/thresholds'
import type { SeriesPoint } from '@/features/telemetry/series'
import { cn } from '@/lib/utils'

type Bounds = { min: number; max: number }

const PERCENT_DOMAIN: [number, number] = [0, 100]
const PERCENT_TICKS = [0, 25, 50, 75, 100]

/** Evenly spaced, round tick values across the domain (≤ 6 ticks). */
function yTicks(domain: [number, number], isPercent: boolean): number[] {
  if (isPercent) return PERCENT_TICKS
  const [lo, hi] = domain
  const step = [5, 10, 20, 25, 50, 100].find((s) => (hi - lo) / s <= 5) ?? 100
  const ticks: number[] = []
  for (let v = Math.ceil(lo / step) * step; v <= hi; v += step) ticks.push(v)
  return ticks
}

/** Temperature scales to the data but always includes the alert threshold. */
function yDomain(spec: MetricSpec, stats: Bounds | null): [number, number] {
  if (spec.key !== 'temperature') return PERCENT_DOMAIN
  const lo = Math.min(stats?.min ?? 0, spec.threshold)
  const hi = Math.max(stats?.max ?? spec.threshold, spec.threshold)
  const pad = Math.max(2, (hi - lo) * 0.08)
  // Round outward to tens so axis ticks land on readable values.
  return [Math.floor((lo - pad) / 10) * 10, Math.ceil((hi + pad) / 10) * 10]
}

const secondsFmt = new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' })
const timeFmt = new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' })
const dayTimeFmt = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
const dayFmt = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' })
const fullFmt = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'medium' })

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR
const TICK_STEPS = [MINUTE, 5 * MINUTE, 15 * MINUTE, 30 * MINUTE, HOUR, 2 * HOUR, 3 * HOUR, 6 * HOUR, 12 * HOUR, DAY, 2 * DAY, 7 * DAY]

/** Round, calendar-aligned x ticks (on the hour, half hour…), at most `max`. */
function timeTicks([lo, hi]: [number, number], max = 5): number[] | undefined {
  const span = hi - lo
  if (span <= 0) return undefined
  const step = TICK_STEPS.find((s) => span / s <= max) ?? Math.ceil(span / max / DAY) * DAY
  // Align to local time so 06:00 lands on 06:00, not on a UTC boundary.
  const offset = new Date(lo).getTimezoneOffset() * MINUTE
  const ticks: number[] = []
  for (let t = Math.ceil((lo - offset) / step) * step + offset; t <= hi; t += step) ticks.push(t)
  return ticks
}

function tickFormatter(spanMs: number) {
  if (spanMs <= 15 * 60_000) return (t: number) => secondsFmt.format(t)
  if (spanMs <= 36 * 3_600_000) return (t: number) => timeFmt.format(t)
  if (spanMs <= 10 * 86_400_000) return (t: number) => dayTimeFmt.format(t)
  return (t: number) => dayFmt.format(t)
}

/** [start, end] of each reporting outage: the real points either side of a null break. */
function gapRanges(points: SeriesPoint[], key: MetricSpec['key']): [number, number][] {
  const gaps: [number, number][] = []
  for (let i = 1; i < points.length - 1; i++) {
    if (points[i]!.count === 0 && points[i - 1]![key] !== null && points[i + 1]![key] !== null) {
      gaps.push([points[i - 1]!.t, points[i + 1]!.t])
    }
  }
  return gaps
}

interface TooltipPayloadItem {
  value?: number | null
  payload?: SeriesPoint
}

function ChartTooltip({
  active,
  payload,
  spec,
}: {
  active?: boolean
  payload?: TooltipPayloadItem[]
  spec: MetricSpec
}) {
  const item = payload?.[0]
  const point = item?.payload
  if (!active || !point || item.value === null || item.value === undefined) return null
  // Flag the bucket if any reading in it crossed the threshold, not just the mean.
  const extremes = point.range?.[spec.key]
  const breached = spec.breached(item.value) || (extremes ? extremes.some((v) => spec.breached(v)) : false)
  return (
    <div className="elevation-2 min-w-44 rounded-lg border bg-popover px-3 py-2.5 text-xs">
      <div className="text-muted-foreground">{fullFmt.format(point.t)}</div>
      <div className="mt-1.5 flex items-baseline justify-between gap-4">
        <span className="text-muted-foreground">{point.count > 1 ? `Avg ${spec.label.toLowerCase()}` : spec.label}</span>
        <span className="tabular font-mono text-sm font-semibold text-foreground">
          {formatNumber(item.value)}
          <span className="ml-0.5 font-sans text-xs font-normal text-muted-foreground">{spec.unit}</span>
        </span>
      </div>
      {point.count > 1 && extremes && (
        <div className="mt-0.5 flex justify-between gap-4 text-muted-foreground">
          <span>{point.count} readings</span>
          <span className="tabular font-mono">
            {formatNumber(extremes[0])}–{formatNumber(extremes[1])}
          </span>
        </div>
      )}
      <div
        className={cn(
          'mt-2 flex items-center gap-1.5 border-t pt-1.5',
          breached ? 'font-medium text-status-critical' : 'text-muted-foreground',
        )}
      >
        {breached && <TriangleAlert className="size-3" aria-hidden="true" />}
        {breached ? 'Outside alert threshold' : spec.ruleLabel}
      </div>
    </div>
  )
}

/**
 * One metric over time. Real readings (or server bucket means) only:
 * null points break the line, outages get a "No data" band, a single
 * reading renders as a single point, and the alert threshold is a red
 * dashed line that is always inside the visible domain.
 */
export function MetricChart({
  spec,
  points,
  stats,
  height = 180,
  compact = false,
  className,
}: {
  spec: MetricSpec
  points: SeriesPoint[]
  stats: Bounds | null
  height?: number
  compact?: boolean
  className?: string
}) {
  const gradientId = useId().replace(/:/g, '')
  const real = points.filter((p) => p[spec.key] !== null)
  const first = real[0]?.t ?? 0
  const last = real[real.length - 1]?.t ?? 0
  const span = last - first
  // A lone reading still needs a visible x-range; pad it by 30 min each side.
  const xDomain: [number, number] = span > 0 ? [first, last] : [first - 1_800_000, last + 1_800_000]
  const domain = yDomain(spec, stats)
  const showDots = real.length <= 40
  const lone = real.length === 1
  const gaps = gapRanges(points, spec.key)
  // Label at most one band (the widest, if it spans ≥15% of the chart) so labels never pile up.
  const widest = gaps.reduce<[number, number] | null>((w, g) => (!w || g[1] - g[0] > w[1] - w[0] ? g : w), null)
  const labelled = widest && widest[1] - widest[0] >= (xDomain[1] - xDomain[0]) * 0.15 ? widest[0] : null
  const summary = stats
    ? `${spec.label}: ${real.length} points, min ${formatNumber(stats.min)}, max ${formatNumber(stats.max)} ${spec.unit}. ${spec.ruleLabel}.${gaps.length ? ` ${gaps.length} reporting ${gaps.length === 1 ? 'gap' : 'gaps'}.` : ''}`
    : `${spec.label}: no data`

  return (
    <div className={cn('w-full', className)} role="img" aria-label={summary} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 320, height }}>
        <AreaChart
          data={points}
          margin={compact ? { top: 4, right: 2, bottom: 2, left: 2 } : { top: 10, right: 6, bottom: 0, left: -14 }}
        >
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.18} />
              <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
            </linearGradient>
          </defs>

          {!compact && <CartesianGrid vertical={false} stroke="var(--border)" />}

          {gaps.map(([x1, x2]) => (
            // Every gap gets a band; only the widest gets a label.
            <ReferenceArea
              key={x1}
              x1={x1}
              x2={x2}
              fill="var(--muted-foreground)"
              fillOpacity={0.08}
              strokeOpacity={0}
              ifOverflow="hidden"
              label={
                compact || x1 !== labelled
                  ? undefined
                  : { value: 'No data', position: 'insideTop', fill: 'var(--muted-foreground)', fontSize: 10 }
              }
            />
          ))}

          <XAxis
            dataKey="t"
            type="number"
            scale="time"
            domain={xDomain}
            hide={compact}
            ticks={timeTicks(xDomain)}
            tickFormatter={tickFormatter(xDomain[1] - xDomain[0])}
            tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }}
            tickLine={false}
            tickMargin={6}
            axisLine={{ stroke: 'var(--border)' }}
            minTickGap={48}
          />
          <YAxis
            domain={domain}
            hide={compact}
            width={40}
            tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            ticks={yTicks(domain, spec.key !== 'temperature')}
            interval={0}
          />

          <ReferenceLine
            y={spec.threshold}
            stroke="var(--status-critical)"
            strokeOpacity={compact ? 0.5 : 0.75}
            strokeDasharray="4 4"
            label={
              compact
                ? undefined
                : {
                    value: `${spec.threshold}${spec.unit === '%' ? '%' : ` ${spec.unit}`}`,
                    position: 'insideTopRight',
                    fill: 'var(--status-critical)',
                    fontSize: 10,
                  }
            }
          />

          <Tooltip
            cursor={{ stroke: 'var(--muted-foreground)', strokeWidth: 1, strokeDasharray: '3 3' }}
            content={<ChartTooltip spec={spec} />}
            isAnimationActive={false}
            allowEscapeViewBox={{ x: false, y: true }}
          />

          <Area
            type="monotone"
            dataKey={spec.key}
            stroke="var(--primary)"
            strokeWidth={compact ? 1.5 : 2}
            fill={`url(#${gradientId})`}
            connectNulls={false}
            isAnimationActive={false}
            dot={
              showDots
                ? { r: lone ? 5 : compact ? 2 : 3, fill: 'var(--primary)', stroke: 'var(--card)', strokeWidth: 1.5 }
                : false
            }
            activeDot={{ r: 4.5, fill: 'var(--primary)', stroke: 'var(--card)', strokeWidth: 2 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

/** Shared key for telemetry charts: series line, threshold, outage band. */
export function MetricChartLegend({ className }: { className?: string }) {
  return (
    <ul className={cn('flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs text-muted-foreground', className)}>
      <li className="flex items-center gap-2">
        <span className="h-0.5 w-5 rounded-full bg-primary" aria-hidden="true" />
        Reading
      </li>
      <li className="flex items-center gap-2">
        <span className="w-5 border-t-2 border-dashed border-status-critical/80" aria-hidden="true" />
        Alert threshold
      </li>
      <li className="flex items-center gap-2">
        <span className="h-3 w-5 rounded-sm bg-muted-foreground/15" aria-hidden="true" />
        No data (device not reporting)
      </li>
    </ul>
  )
}
