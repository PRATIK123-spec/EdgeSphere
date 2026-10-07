import type { QueryClient } from '@tanstack/react-query'

import { alertKeys } from '@/features/alerts/hooks'
import { analyticsKeys } from '@/features/analytics/hooks'
import { dashboardKeys } from '@/features/dashboard/hooks'
import { deviceKeys } from '@/features/devices/hooks'
import { telemetryKeys } from '@/features/telemetry/hooks'
import { invalidateSoon } from '@/lib/query-client'
import type { DeviceResponse, Page, RealtimeEvent, TelemetryResponse } from '@/types/api'

function patchDevice(queryClient: QueryClient, id: number, patch: Partial<DeviceResponse>): void {
  queryClient.setQueryData<DeviceResponse[]>(deviceKeys.list(), (old) =>
    old?.map((d) => (d.id === id ? { ...d, ...patch } : d)),
  )
  queryClient.setQueryData<DeviceResponse>(deviceKeys.detail(id), (old) => (old ? { ...old, ...patch } : old))
}

/**
 * Apply a real-time event to the TanStack Query cache, so every screen
 * reflects it immediately without polling.
 *
 * Telemetry history, series and analytics are deliberately NOT refetched
 * per reading (they are expensive and unbounded in rate); views offer a
 * refresh instead.
 */
export function applyRealtimeEvent(queryClient: QueryClient, event: RealtimeEvent): void {
  switch (event.type) {
    case 'telemetry': {
      queryClient.setQueryData(telemetryKeys.latest(event.device_id), event.data)
      // Prepend to every cached "recent readings" window for this device,
      // trimmed to that window's own limit (the last element of its key).
      for (const query of queryClient.getQueryCache().findAll({
        queryKey: [...telemetryKeys.byDevice(event.device_id), 'recent'],
      })) {
        const limit = Number(query.queryKey[query.queryKey.length - 1]) || 60
        queryClient.setQueryData<Page<TelemetryResponse>>(query.queryKey, (old) =>
          old && !old.items.some((r) => r.id === event.data.id)
            ? { items: [event.data, ...old.items].slice(0, limit), total: old.total + 1 }
            : old,
        )
      }
      patchDevice(queryClient, event.device_id, { last_seen: event.data.created_at, status: 'Online' })
      break
    }
    case 'device.status': {
      patchDevice(queryClient, event.device_id, { status: event.data.status, last_seen: event.data.last_seen })
      invalidateSoon(queryClient, dashboardKeys.summary())
      break
    }
    case 'alert.created':
    case 'alert.updated': {
      invalidateSoon(queryClient, alertKeys.all)
      invalidateSoon(queryClient, dashboardKeys.summary())
      break
    }
    case 'device.created':
    case 'device.updated': {
      queryClient.setQueryData(deviceKeys.detail(event.device_id), event.data)
      invalidateSoon(queryClient, deviceKeys.list())
      invalidateSoon(queryClient, dashboardKeys.summary())
      break
    }
    case 'device.deleted': {
      queryClient.setQueryData<DeviceResponse[]>(deviceKeys.list(), (old) =>
        old?.filter((d) => d.id !== event.device_id),
      )
      for (const key of [
        deviceKeys.detail(event.device_id),
        telemetryKeys.latest(event.device_id),
        analyticsKeys.device(event.device_id),
      ]) {
        queryClient.removeQueries({ queryKey: key, exact: true, type: 'inactive' })
      }
      queryClient.removeQueries({ queryKey: telemetryKeys.byDevice(event.device_id), type: 'inactive' })
      invalidateSoon(queryClient, alertKeys.all)
      invalidateSoon(queryClient, dashboardKeys.summary())
      break
    }
  }
}
