import { useMemo } from 'react'

import { useDevice } from '@/features/devices/hooks'
import { METRICS, metricsFor, type MetricSpec } from '@/features/telemetry/thresholds'

/**
 * Metric specs using this device's own alert thresholds (from the cached
 * device query). Falls back to the defaults until the device has loaded.
 */
export function useDeviceMetrics(deviceId: number): MetricSpec[] {
  const thresholds = useDevice(deviceId).data?.alert_thresholds
  return useMemo(() => (thresholds ? metricsFor(thresholds) : METRICS), [thresholds])
}
