import { apiRequest, apiRequestPage, withQuery } from '@/lib/api-client'
import type { Page, TelemetryResponse, TelemetrySeriesResponse } from '@/types/api'

/** GET /telemetry/latest/{device_id} — null when the device has never reported. */
export function fetchLatestTelemetry(
  deviceId: number,
  signal?: AbortSignal,
): Promise<TelemetryResponse | null> {
  return apiRequest<TelemetryResponse | null>(`/telemetry/latest/${deviceId}`, { signal })
}

export interface TelemetryPageParams {
  limit: number
  offset?: number
  since?: string
  until?: string
}

/**
 * GET /telemetry/{device_id}?limit&offset&since&until — one page, newest
 * first; total in X-Total-Count. The server caps limit at 1000.
 */
export function fetchTelemetryPage(
  deviceId: number,
  params: TelemetryPageParams,
  signal?: AbortSignal,
): Promise<Page<TelemetryResponse>> {
  return apiRequestPage<TelemetryResponse>(withQuery(`/telemetry/${deviceId}`, { ...params }), { signal })
}

/** GET /telemetry/{device_id}/series — readings aggregated server-side into ≤ max_points buckets. */
export function fetchTelemetrySeries(
  deviceId: number,
  params: { since?: string; until?: string; max_points?: number },
  signal?: AbortSignal,
): Promise<TelemetrySeriesResponse> {
  return apiRequest<TelemetrySeriesResponse>(withQuery(`/telemetry/${deviceId}/series`, params), { signal })
}
