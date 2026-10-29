import { DeviceScopedPage } from '@/features/devices/DeviceScopedPage'
import { TelemetryHistoryView } from '@/features/telemetry/TelemetryHistoryView'

export function TelemetryPage() {
  return (
    <DeviceScopedPage
      title="Telemetry"
      description="Every reading one device has reported, charted against its alert thresholds."
    >
      {(device) => <TelemetryHistoryView deviceId={device.id} />}
    </DeviceScopedPage>
  )
}
