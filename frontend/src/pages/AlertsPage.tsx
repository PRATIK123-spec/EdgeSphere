import { useSearchParams } from 'react-router'
import { Cpu } from 'lucide-react'

import { PageHeader } from '@/components/common/PageHeader'
import { CardSkeleton, EmptyState, ErrorState } from '@/components/common/states'
import { AlertsView } from '@/features/alerts/AlertsView'
import { useDevices } from '@/features/devices/hooks'
import { RegisterDeviceButton } from '@/features/devices/RegisterDeviceButton'

export function AlertsPage() {
  const devicesQuery = useDevices()
  const [searchParams, setSearchParams] = useSearchParams()
  const raw = searchParams.get('device')
  const requested = raw && /^\d+$/.test(raw) ? Number(raw) : undefined
  const devices = devicesQuery.data ?? []
  // Ignore a ?device= that is not one of the user's devices (e.g. deleted).
  const deviceId = requested !== undefined && devices.some((d) => d.id === requested) ? requested : undefined

  const setDevice = (id: number | undefined) =>
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        if (id === undefined) next.delete('device')
        else next.set('device', String(id))
        return next
      },
      { replace: true },
    )

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Incident response"
        title="Alerts"
        description="Threshold breaches across your fleet. Acknowledge what you are handling; resolve when it is fixed."
      />
      {devicesQuery.isPending ? (
        <CardSkeleton lines={5} />
      ) : devicesQuery.isError ? (
        <ErrorState error={devicesQuery.error} onRetry={() => void devicesQuery.refetch()} />
      ) : devices.length === 0 ? (
        <EmptyState
          icon={Cpu}
          title="No devices registered"
          description="Alerts appear here once your devices report telemetry that crosses a threshold."
          action={<RegisterDeviceButton />}
        />
      ) : (
        <>
          {requested !== undefined && deviceId === undefined && (
            <p className="rounded-lg border bg-muted/40 px-3 py-2.5 text-sm" role="status">
              Device #{requested} was not found in your account. Showing alerts for all devices.
            </p>
          )}
          <AlertsView key={deviceId ?? 'fleet'} devices={devices} deviceId={deviceId} onDeviceChange={setDevice} />
        </>
      )}
    </div>
  )
}
