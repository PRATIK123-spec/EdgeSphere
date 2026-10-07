import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

import { formatNumber, parseApiDate } from '@/lib/format'
import type { DashboardSummary } from '@/types/api'

const hourFmt = new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' })

interface Bucket {
  t: number
  readings: number
}

function ActivityTooltip({ active, payload }: { active?: boolean; payload?: { payload?: Bucket }[] }) {
  const bucket = payload?.[0]?.payload
  if (!active || !bucket) return null
  return (
    <div className="rounded-lg border bg-popover px-3 py-2 text-xs shadow-md">
      <div className="text-muted-foreground">
        {hourFmt.format(bucket.t)} – {hourFmt.format(bucket.t + 3_600_000)}
      </div>
      <div className="tabular mt-1 font-semibold text-foreground">
        {formatNumber(bucket.readings, 0)} {bucket.readings === 1 ? 'reading' : 'readings'}
      </div>
    </div>
  )
}

/** Readings per hour over the last 24 hours, across the fleet (single series). */
export function ActivityChart({ hourly }: { hourly: DashboardSummary['telemetry']['hourly'] }) {
  const data: Bucket[] = hourly.map((h) => ({ t: parseApiDate(h.hour_start)?.getTime() ?? 0, readings: h.readings }))
  const total = data.reduce((sum, b) => sum + b.readings, 0)

  return (
    <div
      className="h-40 w-full"
      role="img"
      aria-label={`Telemetry readings per hour over the last 24 hours: ${formatNumber(total, 0)} in total`}
    >
      <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 480, height: 160 }}>
        <BarChart data={data} margin={{ top: 6, right: 4, bottom: 0, left: -18 }} barCategoryGap={2}>
          <CartesianGrid vertical={false} stroke="var(--border)" />
          <XAxis
            dataKey="t"
            tickFormatter={(t: number) => hourFmt.format(t)}
            tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }}
            tickLine={false}
            axisLine={{ stroke: 'var(--border)' }}
            interval={5}
          />
          <YAxis
            allowDecimals={false}
            tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            width={44}
          />
          <Tooltip cursor={{ fill: 'var(--muted)', opacity: 0.5 }} content={<ActivityTooltip />} isAnimationActive={false} />
          <Bar dataKey="readings" fill="var(--primary)" radius={[4, 4, 0, 0]} isAnimationActive={false} maxBarSize={18} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
