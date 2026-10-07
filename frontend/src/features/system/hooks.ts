import { useQuery } from '@tanstack/react-query'
import { apiRequest } from '@/lib/api-client'
import type { RootResponse } from '@/types/api'

/** GET / — public root endpoint, used as an API reachability probe. */
export function useApiHealth() {
  return useQuery({
    queryKey: ['system', 'health'],
    queryFn: ({ signal }) => apiRequest<RootResponse>('/', { auth: false, signal }),
    refetchInterval: 30_000,
    retry: false,
    staleTime: 0,
  })
}
