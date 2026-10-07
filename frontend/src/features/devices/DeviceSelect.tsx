import { StatusDot } from '@/components/common/StatusBadge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { DeviceResponse } from '@/types/api'
import { cn } from '@/lib/utils'

export function DeviceSelect({
  devices,
  value,
  onChange,
  className,
}: {
  devices: DeviceResponse[]
  value: number | null
  onChange: (deviceId: number) => void
  className?: string
}) {
  return (
    <Select value={value !== null ? String(value) : undefined} onValueChange={(v) => onChange(Number(v))}>
      <SelectTrigger className={cn('h-9 w-full sm:w-72', className)} aria-label="Select device">
        <SelectValue placeholder="Select a device" />
      </SelectTrigger>
      <SelectContent>
        {devices.map((device) => (
          <SelectItem
            key={device.id}
            value={String(device.id)}
            description={<span className="font-mono text-[10px] text-muted-foreground">{device.serial_number}</span>}
          >
            <span className="inline-flex min-w-0 items-center gap-2">
              <StatusDot status={device.status} />
              <span className="truncate">{device.display_name || `Device ${device.id}`}</span>
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
