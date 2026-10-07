import { parseApiDate } from '@/lib/format'
import { statusTone, type StatusTone } from '@/features/devices/status'
import type { DeviceResponse } from '@/types/api'

const TONE_ORDER: Record<StatusTone, number> = { online: 0, warning: 1, unknown: 2, offline: 3 }

/** Online first, then most recently seen, then name. */
export function sortDevicesForOps(devices: DeviceResponse[]): DeviceResponse[] {
  return [...devices].sort((a, b) => {
    const tone = TONE_ORDER[statusTone(a.status)] - TONE_ORDER[statusTone(b.status)]
    if (tone !== 0) return tone
    const seen = (parseApiDate(b.last_seen)?.getTime() ?? 0) - (parseApiDate(a.last_seen)?.getTime() ?? 0)
    if (seen !== 0) return seen
    return a.display_name.localeCompare(b.display_name)
  })
}
