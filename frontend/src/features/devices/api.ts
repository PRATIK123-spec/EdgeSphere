import { apiRequest } from '@/lib/api-client'
import type { DeviceCreate, DeviceProvisionResponse, DeviceResponse } from '@/types/api'

/** GET /devices/ — devices owned by the current user. Trailing slash is required. */
export function fetchDevices(signal?: AbortSignal): Promise<DeviceResponse[]> {
  return apiRequest<DeviceResponse[]>('/devices/', { signal })
}

/** GET /devices/{id} — 404 if missing or owned by another user. */
export function fetchDevice(id: number, signal?: AbortSignal): Promise<DeviceResponse> {
  return apiRequest<DeviceResponse>(`/devices/${id}`, { signal })
}

/**
 * POST /devices/ → 201 DeviceProvisionResponse.
 * The response is the only time the backend ever returns `device_key`.
 */
export function createDevice(data: DeviceCreate): Promise<DeviceProvisionResponse> {
  return apiRequest<DeviceProvisionResponse>('/devices/', {
    method: 'POST',
    body: { json: data },
  })
}

/** PUT /devices/{id} — full DeviceCreate body; status and firmware are not editable. */
export function updateDevice(id: number, data: DeviceCreate): Promise<DeviceResponse> {
  return apiRequest<DeviceResponse>(`/devices/${id}`, {
    method: 'PUT',
    body: { json: data },
  })
}

/** DELETE /devices/{id} → 204. Cascades to the device's telemetry and alerts. */
export function deleteDevice(id: number): Promise<void> {
  return apiRequest<void>(`/devices/${id}`, { method: 'DELETE' })
}

/**
 * POST /devices/{id}/rotate-key → new DeviceProvisionResponse. The old key
 * stops working immediately; the new key is shown once and never again.
 */
export function rotateDeviceKey(id: number): Promise<DeviceProvisionResponse> {
  return apiRequest<DeviceProvisionResponse>(`/devices/${id}/rotate-key`, { method: 'POST' })
}
