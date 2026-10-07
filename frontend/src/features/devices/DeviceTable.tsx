import { Link, useNavigate } from 'react-router'
import { StatusBadge } from '@/components/common/StatusBadge'
import { TimeAgo } from '@/components/common/TimeAgo'
import { DeviceActionsMenu } from '@/features/devices/DeviceActionsMenu'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { DeviceResponse } from '@/types/api'

export function DeviceTable({ devices }: { devices: DeviceResponse[] }) {
  const navigate = useNavigate()

  return (
    <>
      {/* Table: tablet and up */}
      <div className="surface hidden overflow-x-auto md:block">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="pl-4">Device</TableHead>
              <TableHead>Hardware</TableHead>
              <TableHead>Serial</TableHead>
              <TableHead>Firmware</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Last seen</TableHead>
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
                    className="block rounded-sm font-medium focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:outline-none"
                  >
                    {device.display_name}
                  </Link>
                  <div className="text-xs text-muted-foreground">{device.device_type}</div>
                </TableCell>
                <TableCell>
                  <div>{device.manufacturer}</div>
                  <div className="text-xs text-muted-foreground">{device.model}</div>
                </TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground">{device.serial_number}</TableCell>
                <TableCell className="font-mono text-xs">v{device.firmware_version}</TableCell>
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

      {/* Cards: mobile */}
      <ul className="space-y-2.5 md:hidden">
        {devices.map((device) => (
          <li key={device.id}>
            <button
              type="button"
              onClick={() => navigate(`/devices/${device.id}`)}
              className="surface w-full p-4 text-left transition-colors hover:border-primary/40 focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:outline-none"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate font-medium">{device.display_name}</div>
                  <div className="truncate text-xs text-muted-foreground">
                    {device.device_type} · {device.manufacturer} {device.model}
                  </div>
                </div>
                <StatusBadge status={device.status} />
              </div>
              <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                <span className="font-mono text-[11px]">{device.serial_number}</span>
                <TimeAgo value={device.last_seen} fallback="Never reported" />
              </div>
            </button>
          </li>
        ))}
      </ul>
    </>
  )
}
