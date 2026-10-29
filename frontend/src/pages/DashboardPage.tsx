import { useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { Activity, ArrowRight, Bell, Cpu, KeyRound, Radio, Send, Wifi } from 'lucide-react'

import { PageHeader } from '@/components/common/PageHeader'
import { StatTile } from '@/components/common/StatTile'
import { CardSkeleton, ErrorState, StatTilesSkeleton } from '@/components/common/states'
import { TimeAgo } from '@/components/common/TimeAgo'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuth } from '@/features/auth/auth-context'
import { RecentAlertsCard } from '@/features/alerts/RecentAlertsCard'
import { DeviceInsightsCard } from '@/features/analytics/DeviceInsightsCard'
import { ActivityChart } from '@/features/dashboard/ActivityChart'
import { useDashboardSummary } from '@/features/dashboard/hooks'
import { DeviceStatusGrid } from '@/features/devices/DeviceStatusGrid'
import { FleetStatusBar } from '@/features/devices/FleetStatusBar'
import { RegisterDeviceButton } from '@/features/devices/RegisterDeviceButton'
import { useDevices } from '@/features/devices/hooks'
import { sortDevicesForOps } from '@/features/devices/sort'
import { summarizeFleet } from '@/features/devices/status'
import { formatNumber } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { DashboardSummary, DeviceResponse } from '@/types/api'

const GRID_LIMIT = 6

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
  const hasDevices = devicesQuery.isSuccess && devicesQuery.data.length > 0

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Fleet overview"
        title={`${greeting()}${firstName ? `, ${firstName}` : ''}`}
        description={
          hasDevices ? (
            <>
              Updates live · refreshed <TimeAgo value={new Date(devicesQuery.dataUpdatedAt).toISOString()} />
            </>
          ) : (
            'Current state of your edge fleet.'
          )
        }
        actions={
          hasDevices && (
            <>
              <Button asChild variant="outline">
                <Link to="/devices">
                  All devices <ArrowRight aria-hidden="true" />
                </Link>
              </Button>
              <RegisterDeviceButton />
            </>
          )
        }
      />

      {devicesQuery.isPending ? (
        <DashboardSkeleton />
      ) : devicesQuery.isError ? (
        <ErrorState error={devicesQuery.error} onRetry={() => void devicesQuery.refetch()} />
      ) : devicesQuery.data.length === 0 ? (
        <EmptyFleet />
      ) : (
        <DashboardContent devices={devicesQuery.data} />
      )}
    </div>
  )
}

// ------------------------------------------------------------------ content

function DashboardContent({ devices }: { devices: DeviceResponse[] }) {
  const fleet = summarizeFleet(devices)
  const sorted = sortDevicesForOps(devices)
  const summaryQuery = useDashboardSummary()
  const summary = summaryQuery.data
  // Device insights keeps its own selection; falls back if that device disappears.
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const selected = sorted.find((d) => d.id === selectedId) ?? sorted[0]!

  return (
    <>
      {summaryQuery.isPending ? (
        <StatTilesSkeleton />
      ) : summaryQuery.isError ? (
        <ErrorState
          compact
          error={summaryQuery.error}
          title="Fleet summary unavailable"
          onRetry={() => void summaryQuery.refetch()}
        />
      ) : (
        <KpiRow summary={summaryQuery.data} />
      )}

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="flex min-w-0 flex-col gap-6 xl:col-span-2">
          <Panel
            id="fleet-status"
            title="Fleet status"
            description="Connection state across all devices · updates live"
            aside={
              <div className="text-right">
                <div className="text-metric text-2xl leading-7">
                  {fleet.online}
                  <span className="text-base text-muted-foreground">/{fleet.total}</span>
                </div>
                <div className="text-[11px] text-muted-foreground">online now</div>
              </div>
            }
          >
            <FleetStatusBar summary={fleet} />

            <div className="mt-6 border-t pt-5">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h3 className="text-channel-label">Needs attention first</h3>
                {sorted.length > 4 && (
                  <Link to="/devices" className="text-xs font-medium text-primary hover:underline">
                    View all {sorted.length}
                  </Link>
                )}
              </div>
              <div className="max-sm:[&_li:nth-child(n+5)]:hidden">
                <DeviceStatusGrid devices={sorted.slice(0, GRID_LIMIT)} />
              </div>
            </div>
          </Panel>

          <Panel
            id="activity"
            title="Telemetry activity"
            description="Readings received per hour, last 24 hours"
            aside={summary && <ActivityStats telemetry={summary.telemetry} />}
          >
            {summary ? (
              <ActivityChart hourly={summary.telemetry.hourly} />
            ) : summaryQuery.isError ? (
              <p className="flex h-48 items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
                Activity is unavailable until the fleet summary loads.
              </p>
            ) : (
              <Skeleton className="h-48 w-full" />
            )}
          </Panel>
        </div>

        <div className="flex min-w-0 flex-col gap-6">
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

/** The four headline numbers, all from GET /dashboard/summary. */
function KpiRow({ summary }: { summary: DashboardSummary }) {
  const { devices, alerts, telemetry } = summary
  const availability = devices.total ? Math.round((devices.online / devices.total) * 100) : 0
  const critical = alerts.active_critical > 0
  const high = alerts.active_high > 0

  return (
    <section aria-label="Fleet metrics" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <StatTile
        label="Devices"
        value={formatNumber(devices.total, 0)}
        icon={Cpu}
        hint={devices.never_seen ? `${devices.never_seen} never reported` : 'All have reported'}
      />
      <StatTile
        label="Availability"
        value={
          <>
            {availability}
            <span className="text-lg text-muted-foreground">%</span>
          </>
        }
        icon={Wifi}
        accent="border-status-online/30 bg-status-online/10 text-status-online"
        hint={`${devices.online} online · ${devices.offline} offline`}
      >
        <div
          className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted"
          role="meter"
          aria-label="Devices online"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={availability}
        >
          <div className="h-full rounded-full bg-status-online" style={{ width: `${availability}%` }} />
        </div>
      </StatTile>
      <StatTile
        label="Open alerts"
        value={formatNumber(alerts.active_total, 0)}
        icon={Bell}
        accent={
          critical
            ? 'border-status-critical/30 bg-status-critical/10 text-status-critical'
            : high
              ? 'border-status-warning/30 bg-status-warning/10 text-status-warning'
              : undefined
        }
        hint={
          <span className="flex flex-wrap gap-x-2">
            <span className={cn(critical && 'font-medium text-foreground')}>{alerts.active_critical} critical</span>
            <span className={cn(high && 'font-medium text-foreground')}>{alerts.active_high} high</span>
            <span>{alerts.acknowledged} ack’d</span>
          </span>
        }
      />
      <StatTile
        label="Readings"
        value={formatNumber(telemetry.readings_last_24h, 0)}
        icon={Activity}
        hint={
          <>
            in 24h · {formatNumber(telemetry.readings_last_hour, 0)} last hour
          </>
        }
      />
    </section>
  )
}

function ActivityStats({ telemetry }: { telemetry: DashboardSummary['telemetry'] }) {
  const peak = telemetry.hourly.reduce((max, h) => Math.max(max, h.readings), 0)
  const avg = telemetry.hourly.length ? telemetry.readings_last_24h / telemetry.hourly.length : 0
  return (
    <dl className="flex gap-5 sm:text-right">
      <div>
        <dt className="text-[11px] text-muted-foreground">Avg / hour</dt>
        <dd className="tabular font-mono text-sm font-semibold">{formatNumber(avg, 0)}</dd>
      </div>
      <div>
        <dt className="text-[11px] text-muted-foreground">Peak / hour</dt>
        <dd className="tabular font-mono text-sm font-semibold">{formatNumber(peak, 0)}</dd>
      </div>
    </dl>
  )
}

function Panel({
  id,
  title,
  description,
  aside,
  children,
}: {
  id: string
  title: string
  description: string
  aside?: ReactNode
  children: ReactNode
}) {
  return (
    <section className="surface p-5" aria-labelledby={`${id}-heading`}>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
        <div className="min-w-0">
          <h2 id={`${id}-heading`} className="text-sm font-semibold">
            {title}
          </h2>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
        {aside && <div className="shrink-0">{aside}</div>}
      </div>
      {children}
    </section>
  )
}

// ------------------------------------------------------------ empty / loading

const ONBOARDING_STEPS: { icon: typeof Cpu; title: string; body: ReactNode }[] = [
  {
    icon: KeyRound,
    title: 'Register a device',
    body: 'Give it a name and type. You get its API key once, so copy it somewhere safe.',
  },
  {
    icon: Send,
    title: 'Send telemetry',
    body: (
      <>
        The device posts readings to <code className="text-id rounded bg-muted px-1 py-0.5 whitespace-nowrap">POST /telemetry/</code>{' '}
        with an <code className="text-id rounded bg-muted px-1 py-0.5 whitespace-nowrap">X-DEVICE-KEY</code> header.
      </>
    ),
  },
  {
    icon: Radio,
    title: 'Watch it live',
    body: 'Status, alerts and hourly activity show up here in real time.',
  },
]

function EmptyFleet() {
  return (
    <section
      aria-labelledby="empty-fleet-heading"
      className="bg-grid relative overflow-hidden rounded-xl border bg-card px-5 py-10 sm:px-10 sm:py-14"
    >
      <div className="mx-auto flex max-w-3xl flex-col items-center text-center">
        <div className="elevation-2 mb-5 flex size-14 items-center justify-center rounded-2xl border bg-card">
          <Cpu className="size-6 text-primary" aria-hidden="true" />
        </div>
        <h2 id="empty-fleet-heading" className="text-xl font-semibold tracking-tight text-balance">
          Your fleet is empty
        </h2>
        <p className="mt-2 max-w-md text-sm text-pretty text-muted-foreground">
          Connect your first edge device. Fleet health, alerts and activity will appear here as soon as it
          starts reporting.
        </p>
        <div className="mt-6">
          <RegisterDeviceButton />
        </div>

        <ol className="mt-10 grid w-full gap-3 text-left sm:grid-cols-3">
          {ONBOARDING_STEPS.map((step, i) => (
            <li key={step.title} className="elevation-1 rounded-xl border bg-card p-4">
              <div className="mb-3 flex items-center gap-2.5">
                <span className="flex size-6 items-center justify-center rounded-full border border-primary/30 bg-primary/10 font-mono text-[11px] font-semibold text-primary">
                  {i + 1}
                </span>
                <step.icon className="size-4 text-muted-foreground" aria-hidden="true" />
              </div>
              <h3 className="text-sm font-medium">{step.title}</h3>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{step.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6" role="status" aria-label="Loading dashboard">
      <StatTilesSkeleton />
      <div className="grid gap-6 xl:grid-cols-3">
        <div className="flex flex-col gap-6 xl:col-span-2">
          <div className="surface space-y-5 p-5" aria-hidden="true">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-full rounded-full" />
            <div className="grid gap-3 sm:grid-cols-2">
              {Array.from({ length: 4 }, (_, i) => (
                <Skeleton key={i} className="h-20" />
              ))}
            </div>
          </div>
          <div className="surface space-y-4 p-5" aria-hidden="true">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-48 w-full" />
          </div>
        </div>
        <div className="flex flex-col gap-6">
          <CardSkeleton lines={5} />
          <CardSkeleton lines={4} />
        </div>
      </div>
    </div>
  )
}
