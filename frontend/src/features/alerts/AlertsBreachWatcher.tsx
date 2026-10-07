import { useRefreshAlertsOnBreach } from '@/features/alerts/hooks'

/**
 * Render alongside LatestReadingPanel (which already polls the latest reading)
 * to keep the device's alerts fresh without any additional polling.
 */
export function AlertsBreachWatcher({ deviceId }: { deviceId: number }) {
  useRefreshAlertsOnBreach(deviceId)
  return null
}
