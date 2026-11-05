import type { AlertThresholdValues } from '@/types/api'

/**
 * Alert thresholds per metric. Each device has its own effective thresholds
 * (`DeviceResponse.alert_thresholds`, overrides merged with the defaults by the
 * backend); build specs for a device with `metricsFor` or `useDeviceMetrics`.
 * Used only to colour readouts and draw threshold lines; the backend remains
 * the source of alerts.
 */

export type MetricKey = 'temperature' | 'battery' | 'cpu_usage' | 'ram_usage'

export interface MetricSpec {
  key: MetricKey
  label: string
  /** Narrow-screen column label. */
  short: string
  unit: string
  /** Value at which the backend alert rule fires. */
  threshold: number
  /** Returns true when the reading would trigger the backend alert rule. */
  breached: (value: number) => boolean
  ruleLabel: string
}

/** Mirrors DEFAULT_THRESHOLDS in app/core/alert_thresholds.py. */
export const DEFAULT_ALERT_THRESHOLDS: AlertThresholdValues = {
  temperature_max: 70,
  battery_min: 20,
  cpu_max: 90,
  ram_max: 90,
}

/** Which threshold field drives each metric. */
export const METRIC_THRESHOLD_FIELD: Record<MetricKey, keyof AlertThresholdValues> = {
  temperature: 'temperature_max',
  battery: 'battery_min',
  cpu_usage: 'cpu_max',
  ram_usage: 'ram_max',
}

/** 70 → "70", 72.5 → "72.5", 33.333 → "33.33" */
export function formatThreshold(value: number): string {
  return String(Number(value.toFixed(2)))
}

export function metricsFor(t: AlertThresholdValues): MetricSpec[] {
  return [
    {
      key: 'temperature',
      threshold: t.temperature_max,
      label: 'Temperature',
      short: 'Temp',
      unit: '°C',
      breached: (v) => v > t.temperature_max,
      ruleLabel: `Alert above ${formatThreshold(t.temperature_max)} °C`,
    },
    {
      key: 'battery',
      threshold: t.battery_min,
      label: 'Battery',
      short: 'Batt',
      unit: '%',
      breached: (v) => v < t.battery_min,
      ruleLabel: `Alert below ${formatThreshold(t.battery_min)} %`,
    },
    {
      key: 'cpu_usage',
      threshold: t.cpu_max,
      label: 'CPU',
      short: 'CPU',
      unit: '%',
      breached: (v) => v > t.cpu_max,
      ruleLabel: `Alert above ${formatThreshold(t.cpu_max)} %`,
    },
    {
      key: 'ram_usage',
      threshold: t.ram_max,
      label: 'Memory',
      short: 'Mem',
      unit: '%',
      breached: (v) => v > t.ram_max,
      ruleLabel: `Alert above ${formatThreshold(t.ram_max)} %`,
    },
  ]
}

/** Default-threshold specs: labels, skeletons, and views without a device. */
export const METRICS: MetricSpec[] = metricsFor(DEFAULT_ALERT_THRESHOLDS)
