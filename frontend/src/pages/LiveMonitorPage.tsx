import { RotateCw, WifiOff } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { DeviceScopedPage } from '@/features/devices/DeviceScopedPage'
import { LiveDeviceMonitor } from '@/features/live/LiveDeviceMonitor'
import { useRealtime } from '@/features/realtime/realtime-context'

function ConnectionBanner() {
  const { state, reconnect } = useRealtime()
  if (state === 'live' || state === 'connecting' || state === 'idle') return null
  const message =
    state === 'offline'
      ? 'Your browser is offline. Live updates resume automatically when the connection returns.'
      : state === 'reconnecting'
        ? 'The real-time connection dropped. Reconnecting with backoff; readings fall back to polling meanwhile.'
        : 'Real-time updates are disconnected.'
  return (
    <div role="status" className="flex flex-wrap items-center gap-3 rounded-xl border border-status-warning/40 bg-status-warning/10 px-4 py-3 text-sm">
      <WifiOff className="size-4 shrink-0 text-status-warning" aria-hidden="true" />
      <span className="flex-1">{message}</span>
      {state !== 'offline' && (
        <Button variant="outline" size="sm" onClick={reconnect}>
          <RotateCw aria-hidden="true" /> Reconnect now
        </Button>
      )}
    </div>
  )
}

export function LiveMonitorPage() {
  return (
    <DeviceScopedPage
      eyebrow="Real-time"
      title="Live Monitor"
      description="Telemetry, status changes and alerts pushed over the WebSocket as they happen."
      banner={<ConnectionBanner />}
    >
      {(device) => <LiveDeviceMonitor key={device.id} device={device} />}
    </DeviceScopedPage>
  )
}
