import { DeviceScopedPage } from '@/features/devices/DeviceScopedPage'
import { TelemetryHistoryView } from '@/features/telemetry/TelemetryHistoryView'

export function TelemetryPage() {
  return (
    <DeviceScopedPage
      eyebrow="Raw telemetry"
      title="Telemetry History"
      description="Every reading a device has reported: temperature, battery, CPU and memory over time."
    >
      {(device) => <TelemetryHistoryView deviceId={device.id} />}
    </DeviceScopedPage>
  )
}
