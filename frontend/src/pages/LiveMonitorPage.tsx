import { DeviceScopedPage } from '@/features/devices/DeviceScopedPage'
import { LiveConnectionPanel } from '@/features/live/LiveConnectionPanel'
import { LiveDeviceMonitor } from '@/features/live/LiveDeviceMonitor'

export function LiveMonitorPage() {
  return (
    <DeviceScopedPage
      title="Live Monitor"
      description="Readings, status changes and alerts for one device as they happen."
      banner={<LiveConnectionPanel />}
    >
      {(device) => <LiveDeviceMonitor key={device.id} device={device} />}
    </DeviceScopedPage>
  )
}
