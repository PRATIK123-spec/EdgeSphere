import { Link } from 'react-router'
import { ChevronRight } from 'lucide-react'

import { StatusBadge } from '@/components/common/StatusBadge'
import { TimeAgo } from '@/components/common/TimeAgo'
import { statusTone } from '@/features/devices/status'
import { cn } from '@/lib/utils'
import type { DeviceResponse } from '@/types/api'

export function DeviceStatusGrid({ devices }: { devices: DeviceResponse[] }) {
  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {devices.map((device) => {
        const online = statusTone(device.status) === 'online'
        return (
          <li key={device.id}>
            <Link
              to={`/devices/${device.id}`}
              className={cn(
                'group flex h-full flex-col rounded-lg border bg-background/40 p-3.5 transition-colors',
                'hover:border-primary/40 hover:bg-accent/40 focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:outline-none',
                online && 'border-status-online/20',
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">{device.display_name}</div>
                  <div className="truncate text-xs text-muted-foreground">
                    {device.device_type} · {device.manufacturer}
                  </div>
                </div>
                <StatusBadge status={device.status} />
              </div>
              <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                <span className="truncate font-mono text-[11px]">{device.serial_number}</span>
                <span className="flex shrink-0 items-center gap-1">
                  <TimeAgo value={device.last_seen} fallback="Never" />
                  <ChevronRight
                    className="size-3.5 opacity-0 transition-opacity group-hover:opacity-100"
                    aria-hidden="true"
                  />
                </span>
              </div>
            </Link>
          </li>
        )
      })}
    </ul>
  )
}
