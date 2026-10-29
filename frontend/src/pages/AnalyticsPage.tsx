import { useNavigate } from 'react-router'

import { AnalyticsPanel } from '@/features/analytics/AnalyticsPanel'
import { DeviceScopedPage } from '@/features/devices/DeviceScopedPage'

export function AnalyticsPage() {
  const navigate = useNavigate()

  return (
    <DeviceScopedPage
      title="Analytics"
      description="All-time summary statistics for one device, computed by the server."
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
