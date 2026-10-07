import { useQuery } from '@tanstack/react-query'
import { fetchDeviceAnalytics } from '@/features/analytics/api'

export const analyticsKeys = {
  all: ['analytics'] as const,
  device: (deviceId: number) => [...analyticsKeys.all, 'device', deviceId] as const,
}

/**
 * All-time aggregates for one device. Aggregates move slowly, so they are
 * cached for a minute and refreshed on demand rather than polled.
 */
export function useDeviceAnalytics(deviceId: number, enabled = true) {
  return useQuery({
    queryKey: analyticsKeys.device(deviceId),
    queryFn: ({ signal }) => fetchDeviceAnalytics(deviceId, signal),
    enabled: enabled && Number.isInteger(deviceId) && deviceId > 0,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  })
}
