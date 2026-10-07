/**
 * Alert thresholds mirrored from ALERT_RULES in app/services/alert_service.py.
 * Used only to colour readouts; the backend remains the source of alerts.
 */

export type MetricKey = 'temperature' | 'battery' | 'cpu_usage' | 'ram_usage'

export interface MetricSpec {
  key: MetricKey
  label: string
  unit: string
  /** Value at which the backend alert rule fires. */
  threshold: number
  /** Returns true when the reading would trigger the backend alert rule. */
  breached: (value: number) => boolean
  ruleLabel: string
}

export const METRICS: MetricSpec[] = [
  {
    key: 'temperature',
    threshold: 70,
    label: 'Temperature',
    unit: '°C',
    breached: (v) => v > 70,
    ruleLabel: 'Alert above 70 °C',
  },
  {
    key: 'battery',
    threshold: 20,
    label: 'Battery',
    unit: '%',
    breached: (v) => v < 20,
    ruleLabel: 'Alert below 20 %',
  },
  {
    key: 'cpu_usage',
    threshold: 90,
    label: 'CPU',
    unit: '%',
    breached: (v) => v > 90,
    ruleLabel: 'Alert above 90 %',
  },
  {
    key: 'ram_usage',
    threshold: 90,
    label: 'Memory',
    unit: '%',
    breached: (v) => v > 90,
    ruleLabel: 'Alert above 90 %',
  },
]
