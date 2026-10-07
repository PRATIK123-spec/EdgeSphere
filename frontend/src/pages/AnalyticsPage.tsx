import { useNavigate } from 'react-router'

import { AnalyticsPanel } from '@/features/analytics/AnalyticsPanel'
import { DeviceScopedPage } from '@/features/devices/DeviceScopedPage'

export function AnalyticsPage() {
  const navigate = useNavigate()

  return (
    <DeviceScopedPage
      eyebrow="Aggregates"
      title="Analytics"
      description="Server-computed summary statistics across a device's entire telemetry history."
    >
      {(device) => (
        <AnalyticsPanel
          deviceId={device.id}
          onViewTelemetry={() => navigate(`/telemetry?device=${device.id}`)}
        />
      )}
    </DeviceScopedPage>
  )
}
