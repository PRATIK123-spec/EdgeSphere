import { useState, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { ArrowLeft, Cpu, KeyRound, Pencil, Trash2 } from 'lucide-react'

import { PageHeader } from '@/components/common/PageHeader'
import { CardSkeleton, EmptyState, ErrorState } from '@/components/common/states'
import { StatusBadge } from '@/components/common/StatusBadge'
import { TimeAgo } from '@/components/common/TimeAgo'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { DeleteDeviceDialog } from '@/features/devices/DeleteDeviceDialog'
import { EditDeviceDialog } from '@/features/devices/EditDeviceDialog'
import { RotateKeyDialog } from '@/features/devices/RotateKeyDialog'
import { useDevice } from '@/features/devices/hooks'
import { AlertsView } from '@/features/alerts/AlertsView'
import { AlertsBreachWatcher } from '@/features/alerts/AlertsBreachWatcher'
import { RecentAlertsCard } from '@/features/alerts/RecentAlertsCard'
import { AnalyticsPanel } from '@/features/analytics/AnalyticsPanel'
import { LatestReadingPanel } from '@/features/telemetry/LatestReadingPanel'
import { TelemetryHistoryView } from '@/features/telemetry/TelemetryHistoryView'
import { TelemetryTrendCard } from '@/features/telemetry/TelemetryTrendCard'
import { isApiError } from '@/lib/api-client'
import { formatDateTime } from '@/lib/format'
import type { DeviceResponse } from '@/types/api'

function BackLink() {
  return (
    <Button asChild variant="ghost" size="sm" className="-ml-2 text-muted-foreground">
      <Link to="/devices">
        <ArrowLeft aria-hidden="true" /> Devices
      </Link>
    </Button>
  )
}

export function DeviceDetailPage() {
  const { id } = useParams()
  const deviceId = Number(id)
  const validId = Number.isInteger(deviceId) && deviceId > 0
  const deviceQuery = useDevice(deviceId)
  const navigate = useNavigate()
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [rotateOpen, setRotateOpen] = useState(false)
  const [tab, setTab] = useState('overview')

  if (!validId || (deviceQuery.isError && isApiError(deviceQuery.error) && deviceQuery.error.status === 404)) {
    return (
      <div className="space-y-6">
        <BackLink />
        <EmptyState
          icon={Cpu}
          title="Device not found"
          description="It may have been deleted, or it belongs to another account."
          action={
            <Button asChild variant="outline" size="sm">
              <Link to="/devices">Back to devices</Link>
            </Button>
          }
        />
      </div>
    )
  }

  if (deviceQuery.isPending) {
    return (
      <div className="space-y-6">
        <BackLink />
        <CardSkeleton lines={2} />
        <div className="grid gap-6 lg:grid-cols-3">
          <CardSkeleton className="lg:col-span-2" lines={4} />
          <CardSkeleton lines={6} />
        </div>
      </div>
    )
  }

  if (deviceQuery.isError) {
    return (
      <div className="space-y-6">
        <BackLink />
        <ErrorState error={deviceQuery.error} onRetry={() => void deviceQuery.refetch()} />
      </div>
    )
  }

  const device = deviceQuery.data

  return (
    <div className="space-y-6">
      <BackLink />

      <PageHeader
        eyebrow={`${device.device_type} · ${device.manufacturer}`}
        title={
          <span className="flex flex-wrap items-center gap-3">
            {device.display_name}
            <StatusBadge status={device.status} showIcon />
          </span>
        }
        description={
          <>
            <span className="font-mono text-xs">{device.serial_number}</span>
            <span className="mx-2 text-border">|</span>
            Last seen <TimeAgo value={device.last_seen} fallback="never" />
          </>
        }
        actions={
          <>
            <Button variant="outline" onClick={() => setEditOpen(true)}>
              <Pencil aria-hidden="true" /> Edit
            </Button>
            <Button variant="outline" onClick={() => setRotateOpen(true)}>
              <KeyRound aria-hidden="true" /> Rotate key
            </Button>
            <Button variant="destructive" onClick={() => setDeleteOpen(true)}>
              <Trash2 aria-hidden="true" /> Delete
            </Button>
          </>
        }
      />

      <EditDeviceDialog device={device} open={editOpen} onOpenChange={setEditOpen} />
      <RotateKeyDialog device={device} open={rotateOpen} onOpenChange={setRotateOpen} />
      <DeleteDeviceDialog
        device={device}
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        onDeleted={() => navigate('/devices', { replace: true })}
      />

      <Tabs value={tab} onValueChange={setTab} className="gap-5">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="telemetry">Telemetry</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          <TabsTrigger value="alerts">Alerts</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="space-y-6 lg:col-span-2">
              <LatestReadingPanel deviceId={device.id} />
              <AlertsBreachWatcher deviceId={device.id} />
              <TelemetryTrendCard deviceId={device.id} onViewHistory={() => setTab('telemetry')} />
            </div>
            <div className="space-y-6">
              <DeviceSpecs device={device} />
              <RecentAlertsCard deviceId={device.id} context="Newest alerts for this device" limit={4} />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="telemetry">
          <TelemetryHistoryView deviceId={device.id} />
        </TabsContent>

        <TabsContent value="analytics">
          <AnalyticsPanel deviceId={device.id} onViewTelemetry={() => setTab('telemetry')} />
        </TabsContent>

        <TabsContent value="alerts">
          <AlertsView devices={[device]} deviceId={device.id} />
        </TabsContent>
      </Tabs>
    </div>
  )
}

function DeviceSpecs({ device }: { device: DeviceResponse }) {
  const rows: { label: string; value: ReactNode; mono?: boolean }[] = [
    { label: 'Device ID', value: device.id, mono: true },
    { label: 'Display name', value: device.display_name || '—' },
    { label: 'Type', value: device.device_type },
    { label: 'Manufacturer', value: device.manufacturer },
    { label: 'Model', value: device.model },
    { label: 'Serial number', value: device.serial_number, mono: true },
    { label: 'Firmware', value: `v${device.firmware_version}`, mono: true },
    { label: 'Status', value: <StatusBadge status={device.status} /> },
    { label: 'Last seen', value: device.last_seen ? formatDateTime(device.last_seen) : 'Never reported' },
    { label: 'Registered', value: formatDateTime(device.created_at) },
    {
      label: 'API key',
      value: (
        <span className="inline-flex items-center gap-1.5 font-mono text-xs" title="Key prefix — the full key is never shown again">
          <KeyRound className="size-3.5 text-muted-foreground" aria-hidden="true" />
          {device.key_prefix}…
        </span>
      ),
    },
  ]

  return (
    <section className="surface p-5" aria-labelledby="device-specs-heading">
      <h2 id="device-specs-heading" className="mb-4 text-sm font-semibold">
        Specifications
      </h2>
      <dl className="divide-y">
        {rows.map(({ label, value, mono }) => (
          <div key={label} className="flex items-center justify-between gap-4 py-2.5 text-sm first:pt-0 last:pb-0">
            <dt className="text-muted-foreground">{label}</dt>
            <dd className={mono ? 'truncate font-mono text-xs' : 'truncate text-right'}>{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}
