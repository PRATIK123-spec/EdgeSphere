import { QueryClient, type QueryKey } from '@tanstack/react-query'
import { isApiError } from '@/lib/api-client'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 15_000,
      refetchOnWindowFocus: true,
      // Retry transient/network failures, never client errors (4xx).
      retry: (failureCount, error) => {
        if (isApiError(error) && error.status >= 400 && error.status < 500) return false
        return failureCount < 2
      },
    },
    mutations: {
      retry: false,
    },
  },
})

/**
 * Invalidations requested within this window are merged, so a burst of
 * changes refetches each affected query once instead of once per change.
 * Bursts are common: one reading that breaches several thresholds arrives
 * as one `alert.created` WebSocket message per alert, and acknowledging an
 * alert both settles the mutation and echoes back as an `alert.updated` event.
 *
 * Only queries that already existed when a change was reported are
 * invalidated: a query created afterwards (e.g. a view that mounted in the
 * meantime) fetched after the change and is already up to date.
 */
const INVALIDATE_COALESCE_MS = 50

interface PendingInvalidation {
  queryKey: QueryKey
  /** Hashes of the matching queries that existed when invalidation was requested. */
  existing: Set<string>
}

const pendingInvalidations = new WeakMap<QueryClient, Map<string, PendingInvalidation>>()

export function invalidateSoon(client: QueryClient, queryKey: QueryKey): void {
  let batch = pendingInvalidations.get(client)
  if (!batch) {
    const entries = new Map<string, PendingInvalidation>()
    batch = entries
    pendingInvalidations.set(client, entries)
    setTimeout(() => {
      pendingInvalidations.delete(client)
      for (const { queryKey: key, existing } of entries.values()) {
        void client.invalidateQueries({ queryKey: key, predicate: (query) => existing.has(query.queryHash) })
      }
    }, INVALIDATE_COALESCE_MS)
  }
  const id = JSON.stringify(queryKey)
  const entry = batch.get(id) ?? { queryKey, existing: new Set<string>() }
  for (const query of client.getQueryCache().findAll({ queryKey })) entry.existing.add(query.queryHash)
  batch.set(id, entry)
}
