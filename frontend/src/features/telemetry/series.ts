import { parseApiDate } from '@/lib/format'
import type { MetricKey } from '@/features/telemetry/thresholds'
import type { TelemetryResponse, TelemetrySeriesResponse } from '@/types/api'

/**
 * Pure transforms from raw TelemetryResponse rows to chart series.
 * Nothing here fabricates readings: points are either real readings,
 * time-bucket means of real readings (labelled as such), or explicit
 * `null` breaks where the device was not reporting.
 */

export type TimeRange = '1h' | '24h' | '7d' | '30d' | 'all'

export const TIME_RANGES: { value: TimeRange; label: string; ms: number | null }[] = [
  { value: '1h', label: '1H', ms: 60 * 60_000 },
  { value: '24h', label: '24H', ms: 24 * 60 * 60_000 },
  { value: '7d', label: '7D', ms: 7 * 24 * 60 * 60_000 },
  { value: '30d', label: '30D', ms: 30 * 24 * 60 * 60_000 },
  { value: 'all', label: 'All', ms: null },
]

export interface Reading {
  id: number
  t: number // epoch ms
  temperature: number
  battery: number
  cpu_usage: number
  ram_usage: number
}

export interface SeriesPoint {
  t: number
  temperature: number | null
  battery: number | null
  cpu_usage: number | null
  ram_usage: number | null
  /** Number of raw readings represented by this point (1 = raw reading, 0 = gap break). */
  count: number
  /** Per-metric [min, max] within the bucket (aggregated points only). */
  range?: Record<MetricKey, [number, number]>
}

/** Parse and sort oldest → newest. Rows with unparseable timestamps are dropped. */
export function toReadings(rows: TelemetryResponse[]): Reading[] {
  const readings: Reading[] = []
  for (const row of rows) {
    const date = parseApiDate(row.created_at)
    if (!date) continue
    readings.push({
      id: row.id,
      t: date.getTime(),
      temperature: row.temperature,
      battery: row.battery,
      cpu_usage: row.cpu_usage,
      ram_usage: row.ram_usage,
    })
  }
  return readings.sort((a, b) => a.t - b.t || a.id - b.id)
}

function median(values: number[]): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2
}

/** Minimum silence treated as a reporting gap (matches the 60s offline window). */
const MIN_GAP_MS = 60_000

/**
 * Insert a `null` point between consecutive points that are much further
 * apart than the typical interval, so lines break instead of drawing a
 * misleading straight segment across an outage.
 */
function insertGapBreaks(points: SeriesPoint[]): SeriesPoint[] {
  if (points.length < 3) return points
  const deltas = points.slice(1).map((p, i) => p.t - points[i]!.t)
  const threshold = Math.max(MIN_GAP_MS, median(deltas) * 5)

  const out: SeriesPoint[] = [points[0]!]
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1]!
    const curr = points[i]!
    if (curr.t - prev.t > threshold) {
      out.push({
        t: prev.t + (curr.t - prev.t) / 2,
        temperature: null,
        battery: null,
        cpu_usage: null,
        ram_usage: null,
        count: 0,
      })
    }
    out.push(curr)
  }
  return out
}

const METRIC_KEYS: MetricKey[] = ['temperature', 'battery', 'cpu_usage', 'ram_usage']

export interface ChartSeries {
  points: SeriesPoint[]
  /** True when readings were averaged into time buckets. */
  aggregated: boolean
  readingCount: number
  bucketMs: number | null
}

/**
 * Build a chart series. Above `maxPoints` readings, readings are averaged into
 * equal time buckets (empty buckets are skipped, so gaps stay gaps).
 */
export function buildSeries(readings: Reading[], maxPoints = 400): ChartSeries {
  if (readings.length <= maxPoints) {
    const points = readings.map<SeriesPoint>((r) => ({ ...r, count: 1 }))
    return { points: insertGapBreaks(points), aggregated: false, readingCount: readings.length, bucketMs: null }
  }

  const start = readings[0]!.t
  const end = readings[readings.length - 1]!.t
  const bucketMs = Math.max(1, Math.ceil((end - start + 1) / maxPoints))

  const buckets = new Map<number, { sum: Record<MetricKey, number>; count: number; tSum: number }>()
  for (const r of readings) {
    const index = Math.floor((r.t - start) / bucketMs)
    let bucket = buckets.get(index)
    if (!bucket) {
      bucket = { sum: { temperature: 0, battery: 0, cpu_usage: 0, ram_usage: 0 }, count: 0, tSum: 0 }
      buckets.set(index, bucket)
    }
    for (const key of METRIC_KEYS) bucket.sum[key] += r[key]
    bucket.count += 1
    bucket.tSum += r.t
  }

  const points = [...buckets.entries()]
    .sort(([a], [b]) => a - b)
    .map<SeriesPoint>(([, b]) => ({
      t: Math.round(b.tSum / b.count),
      temperature: b.sum.temperature / b.count,
      battery: b.sum.battery / b.count,
      cpu_usage: b.sum.cpu_usage / b.count,
      ram_usage: b.sum.ram_usage / b.count,
      count: b.count,
    }))

  return { points: insertGapBreaks(points), aggregated: true, readingCount: readings.length, bucketMs }
}

export interface MetricStats {
  latest: number
  min: number
  max: number
  mean: number
}

/** Statistics over raw readings (never over averaged buckets). */
export function metricStats(readings: Reading[], key: MetricKey): MetricStats | null {
  if (readings.length === 0) return null
  let min = Infinity
  let max = -Infinity
  let sum = 0
  for (const r of readings) {
    const v = r[key]
    if (v < min) min = v
    if (v > max) max = v
    sum += v
  }
  return { latest: readings[readings.length - 1]![key], min, max, mean: sum / readings.length }
}

/** Human description of a bucket width, e.g. "2 min". */
export function formatBucket(ms: number): string {
  if (ms < 1000) return `${Math.max(1, Math.round(ms))} ms`
  if (ms < 60_000) return `${Math.round(ms / 1000)} s`
  if (ms < 3_600_000) return `${Math.round(ms / 60_000)} min`
  if (ms < 86_400_000) return `${(ms / 3_600_000).toFixed(1).replace(/\.0$/, '')} h`
  return `${(ms / 86_400_000).toFixed(1).replace(/\.0$/, '')} d`
}

/**
 * Convert the server-aggregated series (GET /telemetry/{id}/series) into
 * chart points. Each point is a bucket mean with its min/max kept for the
 * tooltip; empty buckets are absent server-side, so gaps stay gaps.
 */
export function fromServerSeries(series: TelemetrySeriesResponse): ChartSeries {
  const points: SeriesPoint[] = []
  for (const p of series.points) {
    const date = parseApiDate(p.bucket_start)
    if (!date) continue
    points.push({
      t: date.getTime() + (series.bucket_seconds * 1000) / 2, // bucket midpoint
      temperature: p.avg_temperature,
      battery: p.avg_battery,
      cpu_usage: p.avg_cpu_usage,
      ram_usage: p.avg_ram_usage,
      count: p.count,
      range: {
        temperature: [p.min_temperature, p.max_temperature],
        battery: [p.min_battery, p.max_battery],
        cpu_usage: [p.min_cpu_usage, p.max_cpu_usage],
        ram_usage: [p.min_ram_usage, p.max_ram_usage],
      },
    })
  }
  return {
    points: insertGapBreaks(points),
    aggregated: series.points.some((p) => p.count > 1),
    readingCount: series.readings,
    bucketMs: series.bucket_seconds * 1000,
  }
}

type Point = TelemetrySeriesResponse['points'][number]

const SERIES_FIELDS: Record<MetricKey, { min: (p: Point) => number; max: (p: Point) => number; avg: (p: Point) => number }> = {
  temperature: { min: (p) => p.min_temperature, max: (p) => p.max_temperature, avg: (p) => p.avg_temperature },
  battery: { min: (p) => p.min_battery, max: (p) => p.max_battery, avg: (p) => p.avg_battery },
  cpu_usage: { min: (p) => p.min_cpu_usage, max: (p) => p.max_cpu_usage, avg: (p) => p.avg_cpu_usage },
  ram_usage: { min: (p) => p.min_ram_usage, max: (p) => p.max_ram_usage, avg: (p) => p.avg_ram_usage },
}

/** Exact min/max and count-weighted mean over the whole series. */
export function seriesStats(series: TelemetrySeriesResponse, key: MetricKey): { min: number; max: number; mean: number } | null {
  if (series.points.length === 0 || series.readings === 0) return null
  const f = SERIES_FIELDS[key]
  let min = Infinity
  let max = -Infinity
  let weighted = 0
  for (const p of series.points) {
    min = Math.min(min, f.min(p))
    max = Math.max(max, f.max(p))
    weighted += f.avg(p) * p.count
  }
  return { min, max, mean: weighted / series.readings }
}
