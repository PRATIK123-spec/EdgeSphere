import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { Cpu, ExternalLink, Info } from 'lucide-react'

import { PageHeader } from '@/components/common/PageHeader'
import { StatusBadge } from '@/components/common/StatusBadge'
import { CardSkeleton, EmptyState, ErrorState } from '@/components/common/states'
import { TimeAgo } from '@/components/common/TimeAgo'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { DeviceSelect } from '@/features/devices/DeviceSelect'
import { useDevices } from '@/features/devices/hooks'
import { RegisterDeviceButton } from '@/features/devices/RegisterDeviceButton'
import { useSelectedDevice } from '@/features/devices/use-selected-device'
import type { DeviceResponse } from '@/types/api'

/**
 * Layout for pages that show data for one selected device
 * (Telemetry, Analytics): device list states, selector, and context strip.
 */
export function DeviceScopedPage({
  eyebrow,
  title,
  description,
  headerExtra,
  banner,
  children,
}: {
  eyebrow: string
  title: string
  description: string
  /** Rendered next to the device selector. */
  headerExtra?: ReactNode
  /** Rendered above the device context strip. */
  banner?: ReactNode
  children: (device: DeviceResponse) => ReactNode
}) {
  const devicesQuery = useDevices()
  const { devices, selected, select, requestedMissing, requestedId } = useSelectedDevice(devicesQuery.data)

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={eyebrow}
        title={title}
        description={description}
        actions={
          <>
            {headerExtra}
            {devicesQuery.isPending ? (
              <Skeleton className="h-9 w-72" />
            ) : devices.length > 0 ? (
              <DeviceSelect devices={devices} value={selected?.id ?? null} onChange={select} />
            ) : null}
          </>
        }
      />

      {devicesQuery.isPending ? (
        <CardSkeleton lines={5} />
      ) : devicesQuery.isError ? (
        <ErrorState error={devicesQuery.error} onRetry={() => void devicesQuery.refetch()} />
      ) : !selected ? (
        <EmptyState
          icon={Cpu}
          title="No devices registered"
          description="Register a device and let it report telemetry to see data here."
          action={<RegisterDeviceButton />}
        />
      ) : (
        <>
          {banner}
          {requestedMissing && (
            <div className="flex items-start gap-2 rounded-lg border bg-muted/40 px-3 py-2.5 text-sm" role="status">
              <Info className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              <span>
                Device #{requestedId} was not found in your account. Showing{' '}
                <span className="font-medium">{selected.display_name}</span> instead.
              </span>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border bg-card/60 px-4 py-3 text-sm">
            <span className="font-medium">{selected.display_name}</span>
            <StatusBadge status={selected.status} />
            <span className="font-mono text-xs text-muted-foreground">{selected.serial_number}</span>
            <span className="text-xs text-muted-foreground">
              {selected.device_type} · {selected.manufacturer} {selected.model}
            </span>
            <span className="text-xs text-muted-foreground">
              Last seen <TimeAgo value={selected.last_seen} fallback="never" />
            </span>
            <Button asChild variant="ghost" size="sm" className="ml-auto">
              <Link to={`/devices/${selected.id}`}>
                Device details <ExternalLink aria-hidden="true" />
              </Link>
            </Button>
          </div>

          {children(selected)}
        </>
      )}
    </div>
  )
}
