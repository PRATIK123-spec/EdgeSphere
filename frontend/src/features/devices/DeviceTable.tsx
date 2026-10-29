import { Link, useNavigate } from 'react-router'
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react'

import { StatusBadge } from '@/components/common/StatusBadge'
import { TimeAgo } from '@/components/common/TimeAgo'
import { DeviceActionsMenu } from '@/features/devices/DeviceActionsMenu'
import type { DeviceSort, DeviceSortKey } from '@/features/devices/sort'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { cn } from '@/lib/utils'
import type { DeviceResponse } from '@/types/api'

function SortHeader({
  label,
  sortKey,
  sort,
  onSortChange,
  className,
}: {
  label: string
  sortKey: DeviceSortKey
  sort?: DeviceSort
  onSortChange?: (sort: DeviceSort) => void
  className?: string
}) {
  if (!onSortChange) return <TableHead className={className}>{label}</TableHead>
  const active = sort?.key === sortKey
  const Icon = !active ? ArrowUpDown : sort.dir === 'asc' ? ArrowUp : ArrowDown
  return (
    <TableHead
      className={className}
      aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}
    >
      <button
        type="button"
        onClick={() => onSortChange({ key: sortKey, dir: active && sort.dir === 'asc' ? 'desc' : 'asc' })}
        className={cn(
          '-mx-1.5 inline-flex items-center gap-1 rounded-md px-1.5 py-1 transition-colors hover:text-foreground',
          'focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:outline-none',
          active && 'text-foreground',
        )}
      >
        {label}
        <Icon className={cn('size-3', !active && 'opacity-50')} aria-hidden="true" />
      </button>
    </TableHead>
  )
}

export function DeviceTable({
  devices,
  sort,
  onSortChange,
}: {
  devices: DeviceResponse[]
  sort?: DeviceSort
  onSortChange?: (sort: DeviceSort) => void
}) {
  const navigate = useNavigate()

  return (
    <>
      {/* Table: tablet and up */}
      <div className="surface hidden overflow-x-auto md:block">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <SortHeader label="Device" sortKey="name" sort={sort} onSortChange={onSortChange} className="pl-4" />
              <TableHead>Hardware</TableHead>
              <TableHead className="hidden lg:table-cell">Serial</TableHead>
              <TableHead className="hidden xl:table-cell">Firmware</TableHead>
              <SortHeader label="Status" sortKey="status" sort={sort} onSortChange={onSortChange} />
              <SortHeader label="Last seen" sortKey="last_seen" sort={sort} onSortChange={onSortChange} />
              <TableHead className="w-12 pr-3">
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {devices.map((device) => (
              <TableRow
                key={device.id}
                className="group cursor-pointer"
                onClick={() => navigate(`/devices/${device.id}`)}
              >
                <TableCell className="py-3 pl-4">
                  {/* Real link keeps rows keyboard- and middle-click-accessible */}
                  <Link
                    to={`/devices/${device.id}`}
                    onClick={(e) => e.stopPropagation()}
                    className="block rounded-sm font-medium group-hover:text-primary focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:outline-none"
                  >
                    {device.display_name}
                  </Link>
                  <div className="text-xs text-muted-foreground capitalize">{device.device_type}</div>
                </TableCell>
                <TableCell>
                  <div>{device.manufacturer}</div>
                  <div className="text-xs text-muted-foreground">{device.model}</div>
                </TableCell>
                <TableCell className="hidden font-mono text-xs text-muted-foreground lg:table-cell">
                  {device.serial_number}
                </TableCell>
                <TableCell className="hidden font-mono text-xs xl:table-cell">v{device.firmware_version}</TableCell>
                <TableCell>
                  <StatusBadge status={device.status} />
                </TableCell>
                <TableCell className="text-muted-foreground">
                  <TimeAgo value={device.last_seen} fallback="Never" />
                </TableCell>
                <TableCell className="pr-3 text-right">
                  <DeviceActionsMenu device={device} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Cards: mobile. Stretched link + separate actions menu (no nested buttons). */}
      <ul className="space-y-2.5 md:hidden">
        {devices.map((device) => (
          <li
            key={device.id}
            className="surface relative p-4 transition-colors focus-within:border-primary/50 hover:border-primary/40"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <Link
                  to={`/devices/${device.id}`}
                  className="block truncate font-medium after:absolute after:inset-0 after:rounded-xl focus-visible:outline-none"
                >
                  {device.display_name}
                </Link>
                <div className="truncate text-xs text-muted-foreground">
                  <span className="capitalize">{device.device_type}</span> · {device.manufacturer} {device.model}
                </div>
              </div>
              <div className="relative z-10 -mt-1 -mr-2 shrink-0">
                <DeviceActionsMenu device={device} />
              </div>
            </div>
            <div className="mt-3 flex items-center justify-between gap-3 text-xs text-muted-foreground">
              <StatusBadge status={device.status} />
              <TimeAgo value={device.last_seen} fallback="Never reported" />
            </div>
          </li>
        ))}
      </ul>
    </>
  )
}
