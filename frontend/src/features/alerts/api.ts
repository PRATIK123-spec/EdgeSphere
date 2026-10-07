import { apiRequest, apiRequestPage, withQuery } from '@/lib/api-client'
import type { AlertResponse, AlertStatus, Page } from '@/types/api'

export interface AlertQueryParams {
  /** Restrict to one of the user's devices; omit for the whole fleet. */
  device_id?: number
  severity?: string[]
  alert_type?: string[]
  status?: AlertStatus[]
  since?: string
  until?: string
  limit: number
  offset?: number
}

/**
 * GET /alerts/ — alerts across the current user's devices, newest first,
 * filtered and paginated on the server (total in X-Total-Count).
 */
export function fetchAlerts(params: AlertQueryParams, signal?: AbortSignal): Promise<Page<AlertResponse>> {
  return apiRequestPage<AlertResponse>(withQuery('/alerts/', { ...params }), { signal })
}

/** POST /alerts/{id}/acknowledge — active → acknowledged (idempotent; 409 if resolved). */
export function acknowledgeAlert(id: number): Promise<AlertResponse> {
  return apiRequest<AlertResponse>(`/alerts/${id}/acknowledge`, { method: 'POST' })
}

/** POST /alerts/{id}/resolve — active/acknowledged → resolved (idempotent). */
export function resolveAlert(id: number): Promise<AlertResponse> {
  return apiRequest<AlertResponse>(`/alerts/${id}/resolve`, { method: 'POST' })
}
