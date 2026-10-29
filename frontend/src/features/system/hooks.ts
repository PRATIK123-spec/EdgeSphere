import { useSyncExternalStore } from 'react'
import { useQuery } from '@tanstack/react-query'
import { apiRequest } from '@/lib/api-client'
import { getServerWake, subscribeServerWake, type ServerWakeState } from '@/lib/server-wake'
import type { RootResponse } from '@/types/api'

/** GET / — public root endpoint, used as an API reachability probe. */
export function useApiHealth() {
  return useQuery({
    queryKey: ['system', 'health'],
    queryFn: ({ signal }) => apiRequest<RootResponse>('/', { auth: false, signal, retryOnColdStart: false }),
    refetchInterval: 30_000,
    retry: false,
    staleTime: 0,
  })
}

/** Whether the API currently looks like it is cold-starting (see lib/server-wake). */
export function useServerWake(): ServerWakeState {
  return useSyncExternalStore(subscribeServerWake, getServerWake, getServerWake)
}
