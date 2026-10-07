import { useMutation, useQueryClient } from '@tanstack/react-query'

import { createDevice, deleteDevice, rotateDeviceKey, updateDevice } from '@/features/devices/api'
import { deviceKeys } from '@/features/devices/hooks'
import { alertKeys } from '@/features/alerts/hooks'
import { analyticsKeys } from '@/features/analytics/hooks'
import { dashboardKeys } from '@/features/dashboard/hooks'
import { telemetryKeys } from '@/features/telemetry/hooks'
import { isApiError } from '@/lib/api-client'
import { invalidateSoon } from '@/lib/query-client'
import type { DeviceCreate, DeviceResponse } from '@/types/api'

/**
 * POST /devices/.
 *
 * The provision response carries the one-time `device_key`. Only the public
 * `device` part is written to the query cache; the key is handed to the
 * caller and the mutation result is garbage-collected immediately
 * (gcTime: 0) so it does not linger in the mutation cache.
 */
export function useCreateDevice() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: DeviceCreate) => createDevice(data),
    gcTime: 0,
    onSuccess: ({ device }) => {
      queryClient.setQueryData(deviceKeys.detail(device.id), device)
      invalidateSoon(queryClient, deviceKeys.list())
      invalidateSoon(queryClient, dashboardKeys.summary())
    },
  })
}

/**
 * POST /devices/{id}/rotate-key. Like creation, the result carries a one-time
 * key: only the public `device` part is cached and the mutation result is
 * discarded immediately (gcTime: 0); the caller shows the key once.
 */
export function useRotateDeviceKey() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: number) => rotateDeviceKey(id),
    gcTime: 0,
    onSuccess: ({ device }) => {
      queryClient.setQueryData(deviceKeys.detail(device.id), device)
      invalidateSoon(queryClient, deviceKeys.list())
    },
  })
}

/** PUT /devices/{id} */
export function useUpdateDevice(id: number) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: DeviceCreate) => updateDevice(id, data),
    onSuccess: (device) => {
      queryClient.setQueryData(deviceKeys.detail(id), device)
      invalidateSoon(queryClient, deviceKeys.list())
    },
  })
}

/** DELETE /devices/{id} */
export function useDeleteDevice() {
  const queryClient = useQueryClient()

  const forgetDevice = (id: number) => {
    queryClient.setQueryData<DeviceResponse[]>(deviceKeys.list(), (old) =>
      old?.filter((device) => device.id !== id),
    )
    invalidateSoon(queryClient, deviceKeys.list())
    invalidateSoon(queryClient, alertKeys.all)
    invalidateSoon(queryClient, dashboardKeys.summary())
    // Drop cached detail/telemetry once nothing observes them any more
    // (after the detail page has navigated away), so it cannot refetch a 404.
    window.setTimeout(() => {
      queryClient.removeQueries({ queryKey: deviceKeys.detail(id), exact: true, type: 'inactive' })
      queryClient.removeQueries({ queryKey: telemetryKeys.latest(id), exact: true, type: 'inactive' })
      queryClient.removeQueries({ queryKey: telemetryKeys.byDevice(id), type: 'inactive' })
      queryClient.removeQueries({ queryKey: analyticsKeys.device(id), exact: true, type: 'inactive' })
    }, 0)
  }

  return useMutation({
    mutationFn: (id: number) => deleteDevice(id),
    onSuccess: (_data, id) => forgetDevice(id),
    onError: (error, id) => {
      // 404: it was already deleted (e.g. in another tab) — treat it as gone.
      if (isApiError(error) && error.status === 404) forgetDevice(id)
    },
  })
}
