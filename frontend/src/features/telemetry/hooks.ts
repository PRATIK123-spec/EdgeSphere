import { useQuery } from '@tanstack/react-query'

import {
  fetchLatestTelemetry,
  fetchTelemetryPage,
  fetchTelemetrySeries,
  type TelemetryPageParams,
} from '@/features/telemetry/api'
import { useRealtimeLive } from '@/features/realtime/realtime-context'

export const telemetryKeys = {
  all: ['telemetry'] as const,
  latest: (deviceId: number) => [...telemetryKeys.all, 'latest', deviceId] as const,
  /** Prefix for everything history-like about one device (pages, recent, series). */
  byDevice: (deviceId: number) => [...telemetryKeys.all, 'device', deviceId] as const,
  page: (deviceId: number, params: TelemetryPageParams) =>
    [...telemetryKeys.byDevice(deviceId), 'page', params] as const,
  recent: (deviceId: number, limit: number) => [...telemetryKeys.byDevice(deviceId), 'recent', limit] as const,
  series: (deviceId: number, params: { range: string; anchor: number }) =>
    [...telemetryKeys.byDevice(deviceId), 'series', params] as const,
}

/**
 * Latest reading. While the WebSocket is live, new readings are written into
 * this query's cache by the realtime layer, so polling is switched off; the
 * 5s poll is only the fallback when real-time is unavailable.
 */
export const LIVE_POLL_MS = 5_000

export function useLatestTelemetry(deviceId: number, enabled = true) {
  const live = useRealtimeLive()
  return useQuery({
    queryKey: telemetryKeys.latest(deviceId),
    queryFn: ({ signal }) => fetchLatestTelemetry(deviceId, signal),
    enabled: enabled && Number.isInteger(deviceId) && deviceId > 0,
    refetchInterval: live ? false : LIVE_POLL_MS,
    staleTime: live ? 60_000 : 0,
  })
}

/** One server-side page of raw readings (never the whole history). */
export function useTelemetryPage(deviceId: number, params: TelemetryPageParams, enabled = true) {
  return useQuery({
    queryKey: telemetryKeys.page(deviceId, params),
    queryFn: ({ signal }) => fetchTelemetryPage(deviceId, params, signal),
    enabled: enabled && deviceId > 0,
    // Keep the previous result while paging/changing ranges for the SAME device,
    // but never show one device's data while another is loading.
    placeholderData: (previous, previousQuery) => (previousQuery?.queryKey[2] === deviceId ? previous : undefined),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  })
}

/**
 * The newest `limit` readings (for compact trends and the live monitor).
 * The realtime layer prepends live readings to this cache.
 */
export function useRecentTelemetry(deviceId: number, limit = 60, enabled = true) {
  return useQuery({
    queryKey: telemetryKeys.recent(deviceId, limit),
    queryFn: ({ signal }) => fetchTelemetryPage(deviceId, { limit }, signal),
    enabled: enabled && deviceId > 0,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  })
}

/**
 * Aggregated chart series for a time range. `anchor` (epoch ms) fixes "now"
 * for relative ranges so the query key is stable; refreshing re-anchors.
 */
export function useTelemetrySeries(
  deviceId: number,
  range: { key: string; ms: number | null },
  anchor: number,
  maxPoints = 300,
) {
  return useQuery({
    queryKey: telemetryKeys.series(deviceId, { range: range.key, anchor }),
    queryFn: ({ signal }) =>
      fetchTelemetrySeries(
        deviceId,
        {
          since: range.ms ? new Date(anchor - range.ms).toISOString() : undefined,
          until: new Date(anchor).toISOString(),
          max_points: maxPoints,
        },
        signal,
      ),
    enabled: deviceId > 0,
    // Keep the previous result while paging/changing ranges for the SAME device,
    // but never show one device's data while another is loading.
    placeholderData: (previous, previousQuery) => (previousQuery?.queryKey[2] === deviceId ? previous : undefined),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  })
}
