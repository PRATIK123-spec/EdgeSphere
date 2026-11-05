import { useQuery } from '@tanstack/react-query'
import { fetchDevice, fetchDeviceThresholds, fetchDevices } from '@/features/devices/api'
import { useRealtimeLive } from '@/features/realtime/realtime-context'

export const deviceKeys = {
  all: ['devices'] as const,
  list: () => [...deviceKeys.all, 'list'] as const,
  detail: (id: number) => [...deviceKeys.all, 'detail', id] as const,
  thresholds: (id: number) => [...deviceKeys.all, 'thresholds', id] as const,
}

/**
 * Device status changes on the server (telemetry ingest sets Online, the
 * monitor flips stale devices Offline). While the WebSocket is live those
 * changes arrive as events and are written into this cache, so polling is
 * only a fallback; views still revalidate when they mount.
 */
const DEVICE_REFRESH_MS = 15_000

export function useDevices() {
  const live = useRealtimeLive()
  return useQuery({
    queryKey: deviceKeys.list(),
    queryFn: ({ signal }) => fetchDevices(signal),
    refetchInterval: live ? false : DEVICE_REFRESH_MS,
    staleTime: 0,
  })
}

/** The device's own threshold overrides (only changed by the user, so not polled). */
export function useDeviceThresholds(id: number) {
  return useQuery({
    queryKey: deviceKeys.thresholds(id),
    queryFn: ({ signal }) => fetchDeviceThresholds(id, signal),
    enabled: Number.isInteger(id) && id > 0,
  })
}

export function useDevice(id: number) {
  const live = useRealtimeLive()
  return useQuery({
    queryKey: deviceKeys.detail(id),
    queryFn: ({ signal }) => fetchDevice(id, signal),
    enabled: Number.isInteger(id) && id > 0,
    refetchInterval: live ? false : DEVICE_REFRESH_MS,
    staleTime: 0,
  })
}
