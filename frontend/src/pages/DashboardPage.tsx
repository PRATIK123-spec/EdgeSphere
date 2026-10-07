import { useState } from 'react'
import { Link } from 'react-router'
import { Activity, ArrowRight, Bell, Clock, Cpu, OctagonAlert, Power, TriangleAlert, Wifi } from 'lucide-react'

import { PageHeader } from '@/components/common/PageHeader'
import { StatTile } from '@/components/common/StatTile'
import { CardSkeleton, EmptyState, ErrorState, StatTilesSkeleton } from '@/components/common/states'
import { TimeAgo } from '@/components/common/TimeAgo'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuth } from '@/features/auth/auth-context'
import { RecentAlertsCard } from '@/features/alerts/RecentAlertsCard'
import { DeviceInsightsCard } from '@/features/analytics/DeviceInsightsCard'
import { ActivityChart } from '@/features/dashboard/ActivityChart'
import { useDashboardSummary } from '@/features/dashboard/hooks'
import { DeviceStatusGrid } from '@/features/devices/DeviceStatusGrid'
import { RegisterDeviceButton } from '@/features/devices/RegisterDeviceButton'
import { FleetStatusBar } from '@/features/devices/FleetStatusBar'
import { useDevices } from '@/features/devices/hooks'
import { sortDevicesForOps } from '@/features/devices/sort'
import { summarizeFleet } from '@/features/devices/status'
import { formatNumber } from '@/lib/format'

const GRID_LIMIT = 9

function greeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}

export function DashboardPage() {
  const { user } = useAuth()
  const devicesQuery = useDevices()
  const firstName = user?.full_name.split(' ')[0] ?? ''

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Fleet overview"
        title={`${greeting()}${firstName ? `, ${firstName}` : ''}`}
        description={
          devicesQuery.isSuccess ? (
            <>
              Device states refresh automatically · updated{' '}
              <TimeAgo value={new Date(devicesQuery.dataUpdatedAt).toISOString()} />
            </>
          ) : (
            'Current state of your edge fleet.'
          )
        }
        actions={
          <Button asChild variant="outline">
            <Link to="/devices">
              All devices <ArrowRight aria-hidden="true" />
            </Link>
          </Button>
        }
      />

      {devicesQuery.isPending ? (
        <>
          <StatTilesSkeleton />
          <div className="grid gap-6 xl:grid-cols-3">
            <CardSkeleton className="xl:col-span-2" lines={5} />
            <CardSkeleton lines={4} />
          </div>
        </>
      ) : devicesQuery.isError ? (
        <ErrorState error={devicesQuery.error} onRetry={() => void devicesQuery.refetch()} />
      ) : devicesQuery.data.length === 0 ? (
        <EmptyState
          icon={Cpu}
          title="No devices in your fleet yet"
          description="Register an edge device to get its API key. Its live status, telemetry and alerts will appear here once it starts reporting."
          action={<RegisterDeviceButton />}
        />
      ) : (
        <DashboardContent devices={devicesQuery.data} />
      )}
    </div>
  )
}

function DashboardContent({ devices }: { devices: NonNullable<ReturnType<typeof useDevices>['data']> }) {
  const fleet = summarizeFleet(devices)
  const sorted = sortDevicesForOps(devices)
  const summaryQuery = useDashboardSummary()
  const summary = summaryQuery.data
  // Device insights keeps its own selection; falls back if that device disappears.
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const selected = sorted.find((d) => d.id === selectedId) ?? sorted[0]!

  const availability = summary?.devices.total
    ? Math.round((summary.devices.online / summary.devices.total) * 100)
    : 0
  const tile = (value: number | undefined) => (value === undefined ? '–' : formatNumber(value, 0))

  return (
    <>
      {summaryQuery.isError && (
        <ErrorState compact error={summaryQuery.error} title="Fleet summary unavailable" onRetry={() => void summaryQuery.refetch()} />
      )}

      <section aria-label="Fleet metrics" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          label="Devices"
          value={tile(summary?.devices.total)}
          icon={Cpu}
          hint={summary ? `${summary.devices.never_seen} never reported` : 'Registered to your account'}
        />
        <StatTile
          label="Online"
          value={tile(summary?.devices.online)}
          icon={Wifi}
          accent="border-status-online/30 bg-status-online/10 text-status-online"
          hint={summary ? `${availability}% availability` : 'Reporting telemetry'}
        />
        <StatTile
          label="Open critical"
          value={tile(summary?.alerts.active_critical)}
          icon={OctagonAlert}
          accent={summary?.alerts.active_critical ? 'border-status-critical/30 bg-status-critical/10 text-status-critical' : undefined}
          hint="Unresolved critical alerts"
        />
        <StatTile
          label="Open high"
          value={tile(summary?.alerts.active_high)}
          icon={TriangleAlert}
          accent={summary?.alerts.active_high ? 'border-status-warning/30 bg-status-warning/10 text-status-warning' : undefined}
          hint={summary ? `${summary.alerts.acknowledged} acknowledged` : 'Unresolved high alerts'}
        />
        <StatTile label="Offline" value={tile(summary?.devices.offline)} icon={Power} hint="Not reporting right now" />
        <StatTile
          label="Alerting devices"
          value={tile(summary?.alerts.devices_with_recent_alerts)}
          icon={Bell}
          hint="Raised an alert in the last 24h"
        />
        <StatTile label="Readings · 1h" value={tile(summary?.telemetry.readings_last_hour)} icon={Activity} hint="Across the fleet" />
        <StatTile
          label="Last reading"
          value={
            <span className="text-xl">
              <TimeAgo value={summary?.telemetry.last_reading_at} fallback="None yet" />
            </span>
          }
          icon={Clock}
          hint={summary ? `${formatNumber(summary.telemetry.readings_last_24h, 0)} readings in 24h` : undefined}
        />
      </section>

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="flex flex-col gap-6 xl:col-span-2">
          <section className="surface p-5" aria-labelledby="fleet-status-heading">
            <div className="mb-5">
              <h2 id="fleet-status-heading" className="text-sm font-semibold">
                Fleet status
              </h2>
              <p className="text-xs text-muted-foreground">Connection state across all devices · updates live</p>
            </div>
            <FleetStatusBar summary={fleet} />

            <div className="mt-6 border-t pt-5">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Devices</h3>
                {sorted.length > GRID_LIMIT && (
                  <Link to="/devices" className="text-xs font-medium text-primary hover:underline">
                    View all {sorted.length}
                  </Link>
                )}
              </div>
              <DeviceStatusGrid devices={sorted.slice(0, GRID_LIMIT)} />
            </div>
          </section>

          <section className="surface p-5" aria-labelledby="activity-heading">
            <div className="mb-4">
              <h2 id="activity-heading" className="text-sm font-semibold">
                Telemetry activity
              </h2>
              <p className="text-xs text-muted-foreground">Readings received per hour, last 24 hours</p>
            </div>
            {summary ? <ActivityChart hourly={summary.telemetry.hourly} /> : <Skeleton className="h-40 w-full" />}
          </section>
        </div>

        <div className="flex flex-col gap-6">
          <RecentAlertsCard
            devices={devices}
            status={['active', 'acknowledged']}
            context="Unresolved alerts across your fleet"
          />
          <DeviceInsightsCard devices={sorted} current={selected} onSelect={setSelectedId} />
        </div>
      </div>
    </>
  )
}
