import { createContext, useContext, useEffect, useRef } from 'react'
import type { RealtimeState } from '@/lib/realtime'
import type { RealtimeEvent } from '@/types/api'

export interface RealtimeContextValue {
  state: RealtimeState
  subscribe: (listener: (event: RealtimeEvent) => void) => () => void
  reconnect: () => void
}

const noop = () => () => undefined

export const RealtimeContext = createContext<RealtimeContextValue>({
  state: 'idle',
  subscribe: noop,
  reconnect: () => undefined,
})

export function useRealtime(): RealtimeContextValue {
  return useContext(RealtimeContext)
}

/** True while the socket is authenticated and delivering events. */
export function useRealtimeLive(): boolean {
  return useContext(RealtimeContext).state === 'live'
}

/** Subscribe to real-time events for the lifetime of the component. */
export function useRealtimeEvents(listener: (event: RealtimeEvent) => void): void {
  const { subscribe } = useRealtime()
  const ref = useRef(listener)
  useEffect(() => {
    ref.current = listener
  })
  useEffect(() => subscribe((event) => ref.current(event)), [subscribe])
}
