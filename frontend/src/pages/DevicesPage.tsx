import { useDeferredValue, useMemo, useState } from 'react'
import { Cpu, RotateCw, Search, SearchX, X } from 'lucide-react'

import { PageHeader } from '@/components/common/PageHeader'
import { EmptyState, ErrorState, TableSkeleton } from '@/components/common/states'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { DeviceTable } from '@/features/devices/DeviceTable'
import { RegisterDeviceButton } from '@/features/devices/RegisterDeviceButton'
import { useDevices } from '@/features/devices/hooks'
import { sortDevicesForOps } from '@/features/devices/sort'
import { statusTone, summarizeFleet, type StatusTone } from '@/features/devices/status'
import { cn } from '@/lib/utils'

type Filter = 'all' | Exclude<StatusTone, 'unknown'>

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'online', label: 'Online' },
  { value: 'offline', label: 'Offline' },
  { value: 'warning', label: 'Maintenance' },
]

export function DevicesPage() {
  const devicesQuery = useDevices()
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const deferredSearch = useDeferredValue(search)

  const devices = devicesQuery.data
  const summary = useMemo(() => (devices ? summarizeFleet(devices) : null), [devices])

  const filtered = useMemo(() => {
    if (!devices) return []
    const term = deferredSearch.trim().toLowerCase()
    return sortDevicesForOps(devices).filter((d) => {
      if (filter !== 'all' && statusTone(d.status) !== filter) return false
      if (!term) return true
      return [d.display_name, d.device_type, d.manufacturer, d.model, d.serial_number]
        .some((field) => field.toLowerCase().includes(term))
    })
  }, [devices, deferredSearch, filter])

  const counts: Record<Filter, number> = {
    all: summary?.total ?? 0,
    online: summary?.online ?? 0,
    offline: summary?.offline ?? 0,
    warning: summary?.maintenance ?? 0,
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Inventory"
        title="Devices"
        description={
          summary
            ? `${summary.total} registered · ${summary.online} online`
            : 'Edge devices registered to your account.'
        }
        actions={
          <>
            <Button
              variant="outline"
              onClick={() => void devicesQuery.refetch()}
              disabled={devicesQuery.isFetching}
              aria-label="Refresh devices"
            >
              <RotateCw className={cn(devicesQuery.isFetching && 'animate-spin')} aria-hidden="true" />
              <span className="hidden sm:inline">Refresh</span>
            </Button>
            <RegisterDeviceButton />
          </>
        }
      />

      {devicesQuery.isPending ? (
        <TableSkeleton />
      ) : devicesQuery.isError ? (
        <ErrorState error={devicesQuery.error} onRetry={() => void devicesQuery.refetch()} />
      ) : devicesQuery.data.length === 0 ? (
        <EmptyState
          icon={Cpu}
          title="No devices registered"
          description="Register your first edge device to receive its API key. Once it starts posting telemetry, its live status appears here."
          action={<RegisterDeviceButton />}
        />
      ) : (
        <>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative w-full sm:max-w-xs">
              <Search
                className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <Input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search name, serial, model…"
                aria-label="Search devices"
                className="h-9 pl-9"
              />
            </div>

            <div
              role="group"
              aria-label="Filter by status"
              className="inline-flex w-full rounded-lg border bg-muted/40 p-0.5 sm:w-auto"
            >
              {FILTERS.map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={filter === value}
                  onClick={() => setFilter(value)}
                  className={cn(
                    'flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors sm:flex-none',
                    'focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:outline-none',
                    filter === value
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {label}
                  <span className="tabular text-[11px] text-muted-foreground">{counts[value]}</span>
                </button>
              ))}
            </div>
          </div>

          {filtered.length === 0 ? (
            <EmptyState
              icon={SearchX}
              title="No matching devices"
              description="Try a different search term or status filter."
              action={
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSearch('')
                    setFilter('all')
                  }}
                >
                  <X aria-hidden="true" /> Clear filters
                </Button>
              }
            />
          ) : (
            <DeviceTable devices={filtered} />
          )}
        </>
      )}
    </div>
  )
}
