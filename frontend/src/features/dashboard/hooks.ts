import { useQuery } from '@tanstack/react-query'

import { apiRequest } from '@/lib/api-client'
import { useRealtimeLive } from '@/features/realtime/realtime-context'
import type { DashboardSummary } from '@/types/api'

export const dashboardKeys = {
  all: ['dashboard'] as const,
  summary: () => [...dashboardKeys.all, 'summary'] as const,
}

/**
 * GET /dashboard/summary — fleet aggregates computed in SQL.
 * Real-time alert/status events invalidate it immediately; the slow poll
 * only keeps the telemetry activity counters current.
 */
export function useDashboardSummary() {
  const live = useRealtimeLive()
  return useQuery({
    queryKey: dashboardKeys.summary(),
    queryFn: ({ signal }) => apiRequest<DashboardSummary>('/dashboard/summary', { signal }),
    staleTime: 15_000,
    refetchInterval: live ? 60_000 : 30_000,
  })
}
