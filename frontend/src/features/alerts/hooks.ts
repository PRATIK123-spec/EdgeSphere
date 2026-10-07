import { useEffect, useRef } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import { acknowledgeAlert, fetchAlerts, resolveAlert, type AlertQueryParams } from '@/features/alerts/api'
import { dashboardKeys } from '@/features/dashboard/hooks'
import { useRealtimeLive } from '@/features/realtime/realtime-context'
import { useLatestTelemetry } from '@/features/telemetry/hooks'
import { METRICS } from '@/features/telemetry/thresholds'
import { getErrorMessage, isApiError } from '@/lib/api-client'
import { invalidateSoon } from '@/lib/query-client'

export const alertKeys = {
  all: ['alerts'] as const,
  list: (params: AlertQueryParams) => [...alertKeys.all, 'list', params] as const,
}

/**
 * Alerts from the server with filters/pagination applied server-side.
 * Not polled: new alerts and state changes arrive as WebSocket events,
 * which invalidate these queries.
 */
export function useAlerts(params: AlertQueryParams, enabled = true) {
  return useQuery({
    queryKey: alertKeys.list(params),
    queryFn: ({ signal }) => fetchAlerts(params, signal),
    enabled,
    staleTime: 30_000,
    // Keep the previous page visible while paging/filtering.
    placeholderData: (previous, previousQuery) =>
      (previousQuery?.queryKey[2] as AlertQueryParams | undefined)?.device_id === params.device_id ? previous : undefined,
  })
}

/** Acknowledge / resolve one alert; refreshes alert lists and dashboard counts. */
export function useAlertAction(action: 'acknowledge' | 'resolve') {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => (action === 'acknowledge' ? acknowledgeAlert(id) : resolveAlert(id)),
    onSuccess: () => {
      toast.success(action === 'acknowledge' ? 'Alert acknowledged' : 'Alert resolved')
    },
    onError: (error) => {
      const message =
        isApiError(error) && error.status === 409 ? 'This alert has already been resolved.' : getErrorMessage(error)
      toast.error(action === 'acknowledge' ? 'Could not acknowledge alert' : 'Could not resolve alert', {
        description: message,
      })
    },
    onSettled: () => {
      // Merged with the alert.updated event this action triggers (one refetch, not two).
      invalidateSoon(queryClient, alertKeys.all)
      invalidateSoon(queryClient, dashboardKeys.summary())
    },
  })
}

/**
 * Fallback when the WebSocket is not live: refresh the device's alerts when
 * the existing latest-reading poll sees a NEW reading that breaches a
 * threshold. With a live socket, alert events do this instead.
 */
export function useRefreshAlertsOnBreach(deviceId: number) {
  const queryClient = useQueryClient()
  const live = useRealtimeLive()
  const latest = useLatestTelemetry(deviceId)
  const seenId = useRef<number | null>(null)

  useEffect(() => {
    const reading = latest.data
    if (!reading) return
    const previous = seenId.current
    seenId.current = reading.id
    if (live || previous === null || reading.id === previous) return
    if (METRICS.some((m) => m.breached(reading[m.key]))) {
      void queryClient.invalidateQueries({ queryKey: alertKeys.all })
    }
  }, [latest.data, live, queryClient])
}
