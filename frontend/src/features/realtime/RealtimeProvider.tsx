import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import { alertKeys } from '@/features/alerts/hooks'
import { severityMeta } from '@/features/alerts/meta'
import { dashboardKeys } from '@/features/dashboard/hooks'
import { deviceKeys } from '@/features/devices/hooks'
import { applyRealtimeEvent } from '@/features/realtime/cache-sync'
import { telemetryKeys } from '@/features/telemetry/hooks'
import { RealtimeContext, type RealtimeContextValue } from '@/features/realtime/realtime-context'
import { getToken } from '@/lib/auth-storage'
import { RealtimeClient, type RealtimeState } from '@/lib/realtime'
import type { DeviceResponse, RealtimeEvent } from '@/types/api'

/**
 * Owns the single WebSocket for the signed-in user (mounted inside the
 * authenticated app shell). Keeps the query cache in sync and raises toasts
 * for new alerts. Auth rejection ends the session via `onSessionRejected`.
 */
export function RealtimeProvider({
  children,
  onSessionRejected,
}: {
  children: ReactNode
  onSessionRejected: () => void
}) {
  const queryClient = useQueryClient()
  const [state, setState] = useState<RealtimeState>('idle')
  const listeners = useRef(new Set<(event: RealtimeEvent) => void>())
  const clientRef = useRef<RealtimeClient | null>(null)
  const rejectRef = useRef(onSessionRejected)
  useEffect(() => {
    rejectRef.current = onSessionRejected
  })

  useEffect(() => {
    const client = new RealtimeClient(getToken, () => rejectRef.current())
    clientRef.current = client
    let wasLive = false
    const offState = client.onState((next) => {
      setState(next)
      if (next !== 'live') return
      if (wasLive) {
        // Reconnected: events sent while the socket was down were missed,
        // so resync everything that events normally keep fresh.
        void queryClient.invalidateQueries({ queryKey: deviceKeys.all })
        void queryClient.invalidateQueries({ queryKey: [...telemetryKeys.all, 'latest'] })
        void queryClient.invalidateQueries({ queryKey: telemetryKeys.all, predicate: (q) => q.queryKey.includes('recent') })
        void queryClient.invalidateQueries({ queryKey: alertKeys.all })
        void queryClient.invalidateQueries({ queryKey: dashboardKeys.summary() })
      }
      wasLive = true
    })
    const offEvent = client.onEvent((event) => {
      applyRealtimeEvent(queryClient, event)
      if (event.type === 'alert.created') {
        const device = queryClient
          .getQueryData<DeviceResponse[]>(deviceKeys.list())
          ?.find((d) => d.id === event.device_id)
        const meta = severityMeta(event.data.severity)
        const show = event.data.severity.toUpperCase() === 'CRITICAL' ? toast.error : toast.warning
        show(`${meta.label} alert · ${device?.display_name ?? `Device ${event.device_id}`}`, {
          description: event.data.message,
        })
      }
      listeners.current.forEach((fn) => fn(event))
    })
    client.start()
    return () => {
      offState()
      offEvent()
      client.stop()
      clientRef.current = null
    }
  }, [queryClient])

  const subscribe = useCallback((listener: (event: RealtimeEvent) => void) => {
    listeners.current.add(listener)
    return () => {
      listeners.current.delete(listener)
    }
  }, [])

  const reconnect = useCallback(() => clientRef.current?.reconnectNow(), [])

  const value = useMemo<RealtimeContextValue>(() => ({ state, subscribe, reconnect }), [state, subscribe, reconnect])

  return <RealtimeContext.Provider value={value}>{children}</RealtimeContext.Provider>
}
