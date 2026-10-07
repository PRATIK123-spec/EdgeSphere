import { useId } from 'react'
import {
  Area,
  AreaChart,
  CartesianGrid,
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

function yDomain(spec: MetricSpec, stats: Bounds | null): [number, number] {
  if (spec.key !== 'temperature') return PERCENT_DOMAIN
  if (!stats) return [0, 100]
  // Round outward to tens so axis ticks land on readable values.
  const pad = Math.max(2, (stats.max - stats.min) * 0.1)
  return [Math.floor((stats.min - pad) / 10) * 10, Math.ceil((stats.max + pad) / 10) * 10]
}

const secondsFmt = new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' })
const timeFmt = new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' })
const dayTimeFmt = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
const dayFmt = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' })
const fullFmt = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'medium' })

function tickFormatter(spanMs: number) {
  if (spanMs <= 15 * 60_000) return (t: number) => secondsFmt.format(t)
  if (spanMs <= 36 * 3_600_000) return (t: number) => timeFmt.format(t)
  if (spanMs <= 10 * 86_400_000) return (t: number) => dayTimeFmt.format(t)
  return (t: number) => dayFmt.format(t)
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
    <div className="rounded-lg border bg-popover px-3 py-2 text-xs shadow-md">
      <div className="text-muted-foreground">{fullFmt.format(point.t)}</div>
      <div className="mt-1 flex items-baseline gap-1.5">
        <span className="text-muted-foreground">{spec.label}</span>
        <span className="tabular font-semibold text-foreground">
          {formatNumber(item.value)} {spec.unit}
        </span>
      </div>
      {point.count > 1 && (
        <div className="mt-0.5 text-muted-foreground">
          Average of {point.count} readings
          {point.range && (
            <>
              {' '}
              · range {formatNumber(point.range[spec.key][0])}–{formatNumber(point.range[spec.key][1])}
            </>
          )}
        </div>
      )}
      {breached && <div className="mt-0.5 font-medium text-status-critical">Outside alert threshold</div>}
    </div>
  )
}

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
  const span = real.length > 1 ? real[real.length - 1]!.t - real[0]!.t : 0
  const domain = yDomain(spec, stats)
  const threshold = spec.threshold
  const showDots = real.length <= 40
  const summary = stats
    ? `${spec.label}: ${real.length} points, min ${formatNumber(stats.min)}, max ${formatNumber(stats.max)} ${spec.unit}`
    : `${spec.label}: no data`

  return (
    <div className={cn('w-full', className)} role="img" aria-label={summary} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 320, height }}>
        <AreaChart
          data={points}
          margin={compact ? { top: 4, right: 2, bottom: 2, left: 2 } : { top: 8, right: 8, bottom: 0, left: -12 }}
        >
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.22} />
              <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
            </linearGradient>
          </defs>

          {!compact && <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="0" />}

          <XAxis
            dataKey="t"
            type="number"
            scale="time"
            domain={['dataMin', 'dataMax']}
            hide={compact}
            tickFormatter={tickFormatter(span)}
            tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }}
            tickLine={false}
            axisLine={{ stroke: 'var(--border)' }}
            minTickGap={36}
          />
          <YAxis
            domain={domain}
            hide={compact}
            width={44}
            tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            ticks={yTicks(domain, spec.key !== 'temperature')}
            interval={0}
          />

          <ReferenceLine
            y={threshold}
            stroke="var(--status-critical)"
            strokeOpacity={compact ? 0.45 : 0.7}
            strokeDasharray="4 4"
            ifOverflow="discard"
          />

          <Tooltip
            cursor={{ stroke: 'var(--muted-foreground)', strokeWidth: 1, strokeDasharray: '3 3' }}
            content={<ChartTooltip spec={spec} />}
            isAnimationActive={false}
          />

          <Area
            type="monotone"
            dataKey={spec.key}
            stroke="var(--primary)"
            strokeWidth={compact ? 1.5 : 2}
            fill={`url(#${gradientId})`}
            connectNulls={false}
            isAnimationActive={false}
            dot={showDots ? { r: compact ? 2 : 3, fill: 'var(--primary)', stroke: 'var(--card)', strokeWidth: 1.5 } : false}
            activeDot={{ r: 4, fill: 'var(--primary)', stroke: 'var(--card)', strokeWidth: 2 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
