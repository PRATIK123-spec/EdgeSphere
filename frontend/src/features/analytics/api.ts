import { apiRequest, isApiError } from '@/lib/api-client'
import type { DeviceAnalyticsResponse } from '@/types/api'

/** Exact `detail` the backend returns when a device has zero telemetry rows. */
const NO_TELEMETRY_DETAIL = 'No telemetry found for this device'

/**
 * GET /analytics/device/{device_id}.
 *
 * The backend answers 404 both for "device not found / not yours" and for
 * "device has no telemetry". The second case is a normal empty state, so it
 * is mapped to `null`; every other error (including device-not-found) throws.
 */
export async function fetchDeviceAnalytics(
  deviceId: number,
  signal?: AbortSignal,
): Promise<DeviceAnalyticsResponse | null> {
  try {
    return await apiRequest<DeviceAnalyticsResponse>(`/analytics/device/${deviceId}`, { signal })
  } catch (error) {
    if (isApiError(error) && error.status === 404 && error.message === NO_TELEMETRY_DETAIL) {
      return null
    }
    throw error
  }
}
