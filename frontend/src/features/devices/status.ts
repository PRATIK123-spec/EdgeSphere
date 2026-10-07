import type { DeviceResponse, DeviceStatus } from '@/types/api'

export type StatusTone = 'online' | 'offline' | 'warning' | 'unknown'

export function statusTone(status: DeviceStatus): StatusTone {
  switch (status.toLowerCase()) {
    case 'online':
      return 'online'
    case 'offline':
      return 'offline'
    case 'maintenance':
      return 'warning'
    default:
      return 'unknown'
  }
}

export interface FleetSummary {
  total: number
  online: number
  offline: number
  maintenance: number
  other: number
}

export function summarizeFleet(devices: DeviceResponse[]): FleetSummary {
  const summary: FleetSummary = { total: devices.length, online: 0, offline: 0, maintenance: 0, other: 0 }
  for (const device of devices) {
    const tone = statusTone(device.status)
    if (tone === 'online') summary.online += 1
    else if (tone === 'offline') summary.offline += 1
    else if (tone === 'warning') summary.maintenance += 1
    else summary.other += 1
  }
  return summary
}
