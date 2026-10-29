import { parseApiDate } from '@/lib/format'
import { statusTone, type StatusTone } from '@/features/devices/status'
import type { DeviceResponse } from '@/types/api'

const TONE_ORDER: Record<StatusTone, number> = { online: 0, warning: 1, unknown: 2, offline: 3 }

const byStatus = (a: DeviceResponse, b: DeviceResponse) =>
  TONE_ORDER[statusTone(a.status)] - TONE_ORDER[statusTone(b.status)]
const byLastSeen = (a: DeviceResponse, b: DeviceResponse) =>
  (parseApiDate(b.last_seen)?.getTime() ?? 0) - (parseApiDate(a.last_seen)?.getTime() ?? 0)
const byName = (a: DeviceResponse, b: DeviceResponse) =>
  a.display_name.localeCompare(b.display_name, undefined, { sensitivity: 'base' })

/** Online first, then most recently seen, then name. */
export function sortDevicesForOps(devices: DeviceResponse[]): DeviceResponse[] {
  return [...devices].sort((a, b) => byStatus(a, b) || byLastSeen(a, b) || byName(a, b))
}

export type DeviceSortKey = 'name' | 'status' | 'last_seen'
export type SortDirection = 'asc' | 'desc'
export interface DeviceSort {
  key: DeviceSortKey
  dir: SortDirection
}

/**
 * User-chosen ordering for the devices list. `asc` means A→Z, online→offline,
 * and most recent first for last seen; never-seen devices always sort last.
 */
export function sortDevices(devices: DeviceResponse[], { key, dir }: DeviceSort): DeviceResponse[] {
  const sign = dir === 'asc' ? 1 : -1
  return [...devices].sort((a, b) => {
    if (key === 'last_seen') {
      if (!a.last_seen !== !b.last_seen) return a.last_seen ? -1 : 1
      return sign * byLastSeen(a, b) || byName(a, b)
    }
    if (key === 'status') return sign * byStatus(a, b) || byLastSeen(a, b) || byName(a, b)
    return sign * byName(a, b)
  })
}
