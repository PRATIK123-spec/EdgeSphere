import { useDeferredValue, useMemo, useState } from 'react'
import { ArrowDownWideNarrow, ArrowUpNarrowWide, Cpu, RotateCw, Search, SearchX, X } from 'lucide-react'

import { PageHeader } from '@/components/common/PageHeader'
import { EmptyState, ErrorState, TableSkeleton } from '@/components/common/states'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { DeviceTable } from '@/features/devices/DeviceTable'
import { RegisterDeviceButton } from '@/features/devices/RegisterDeviceButton'
import { useDevices } from '@/features/devices/hooks'
import { sortDevices, sortDevicesForOps, type DeviceSort, type DeviceSortKey } from '@/features/devices/sort'
import { statusTone, summarizeFleet, type StatusTone } from '@/features/devices/status'
import { cn } from '@/lib/utils'

type Filter = 'all' | Exclude<StatusTone, 'unknown'>

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'online', label: 'Online' },
  { value: 'offline', label: 'Offline' },
  { value: 'warning', label: 'Maintenance' },
]

const SORT_LABELS: Record<DeviceSortKey | 'attention', string> = {
  attention: 'Needs attention',
  name: 'Name',
  status: 'Status',
  last_seen: 'Last seen',
}

export function DevicesPage() {
  const devicesQuery = useDevices()
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [type, setType] = useState('all')
  // null = operational order (online first, most recently seen).
  const [sort, setSort] = useState<DeviceSort | null>(null)
  const deferredSearch = useDeferredValue(search)

  const devices = devicesQuery.data
  const summary = useMemo(() => (devices ? summarizeFleet(devices) : null), [devices])
  const types = useMemo(
    () => [...new Set((devices ?? []).map((d) => d.device_type.toLowerCase()))].sort(),
    [devices],
  )

  const filtered = useMemo(() => {
    if (!devices) return []
    const term = deferredSearch.trim().toLowerCase()
    const ordered = sort ? sortDevices(devices, sort) : sortDevicesForOps(devices)
    return ordered.filter((d) => {
      if (filter !== 'all' && statusTone(d.status) !== filter) return false
      if (type !== 'all' && d.device_type.toLowerCase() !== type) return false
      if (!term) return true
      return [d.display_name, d.device_type, d.manufacturer, d.model, d.serial_number].some((field) =>
        field.toLowerCase().includes(term),
      )
    })
  }, [devices, deferredSearch, filter, type, sort])

  const counts: Record<Filter, number> = {
    all: summary?.total ?? 0,
    online: summary?.online ?? 0,
    offline: summary?.offline ?? 0,
    warning: summary?.maintenance ?? 0,
  }
  const filtersActive = search !== '' || filter !== 'all' || type !== 'all'
  const clearFilters = () => {
    setSearch('')
    setFilter('all')
    setType('all')
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Devices"
        description={
          summary?.total
            ? `${summary.total} registered, ${summary.online} online now`
            : 'Edge devices registered to your account.'
        }
        actions={
          summary?.total !== 0 && (
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
          )
        }
      />

      {devicesQuery.isPending ? (
        <div className="space-y-4">
          <div className="flex flex-col gap-3 lg:flex-row" aria-hidden="true">
            <div className="h-9 rounded-lg border bg-muted/40 lg:w-72" />
            <div className="h-9 rounded-lg border bg-muted/40 lg:w-80" />
          </div>
          <TableSkeleton />
        </div>
      ) : devicesQuery.isError ? (
        <ErrorState error={devicesQuery.error} onRetry={() => void devicesQuery.refetch()} />
      ) : devicesQuery.data.length === 0 ? (
        <EmptyState
          icon={Cpu}
          title="No devices registered"
          description="Register your first edge device to get its API key. Its live status appears here once it posts telemetry."
          action={<RegisterDeviceButton />}
        />
      ) : (
        <>
          <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-center">
            <div className="relative w-full lg:w-72">
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
              className="flex w-full overflow-x-auto rounded-lg border bg-muted/40 p-0.5 lg:w-auto"
            >
              {FILTERS.map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={filter === value}
                  onClick={() => setFilter(value)}
                  className={cn(
                    'flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors lg:flex-none',
                    'focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:outline-none',
                    filter === value
                      ? 'elevation-1 bg-background text-foreground'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {label}
                  <span className="tabular text-[11px] text-muted-foreground">{counts[value]}</span>
                </button>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-3 lg:flex lg:items-center">
              <Select value={type} onValueChange={setType}>
                <SelectTrigger className="h-9 w-full lg:w-40" aria-label="Filter by type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All types</SelectItem>
                  {types.map((t) => (
                    <SelectItem key={t} value={t}>
                      <span className="capitalize">{t}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <div className="flex gap-1.5">
                <Select
                  value={sort?.key ?? 'attention'}
                  onValueChange={(v) =>
                    setSort(v === 'attention' ? null : { key: v as DeviceSortKey, dir: sort?.dir ?? 'asc' })
                  }
                >
                  <SelectTrigger className="h-9 w-full min-w-0 *:data-[slot=select-value]:mr-auto lg:w-52" aria-label="Sort devices">
                    <span className="hidden text-muted-foreground sm:inline">Sort:</span>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(SORT_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {sort && (
                  <Button
                    variant="outline"
                    size="icon"
                    className="size-9 shrink-0"
                    onClick={() => setSort({ ...sort, dir: sort.dir === 'asc' ? 'desc' : 'asc' })}
                    aria-label={sort.dir === 'asc' ? 'Sort descending' : 'Sort ascending'}
                    title={sort.dir === 'asc' ? 'Ascending' : 'Descending'}
                  >
                    {sort.dir === 'asc' ? (
                      <ArrowUpNarrowWide aria-hidden="true" />
                    ) : (
                      <ArrowDownWideNarrow aria-hidden="true" />
                    )}
                  </Button>
                )}
              </div>
            </div>

            <p className="text-xs text-muted-foreground lg:ml-auto" aria-live="polite">
              {filtersActive ? (
                <>
                  {filtered.length} of {devices!.length} devices
                  <button
                    type="button"
                    onClick={clearFilters}
                    className="ml-2 rounded-sm font-medium text-primary hover:underline focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:outline-none"
                  >
                    Clear filters
                  </button>
                </>
              ) : (
                `${devices!.length} devices`
              )}
            </p>
          </div>

          {filtered.length === 0 ? (
            <EmptyState
              icon={SearchX}
              title="No matching devices"
              description="Nothing matches this search and these filters. Clear them to see every device."
              action={
                <Button variant="outline" size="sm" onClick={clearFilters}>
                  <X aria-hidden="true" /> Clear filters
                </Button>
              }
            />
          ) : (
            <DeviceTable devices={filtered} sort={sort ?? undefined} onSortChange={setSort} />
          )}
        </>
      )}
    </div>
  )
}
