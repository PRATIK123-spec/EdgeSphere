import { useCallback, useEffect, useMemo } from 'react'
import { useSearchParams } from 'react-router'

import { sortDevicesForOps } from '@/features/devices/sort'
import type { DeviceResponse } from '@/types/api'

/**
 * Device selection stored in the `?device=<id>` search param, so the view is
 * linkable and survives reloads. Only the numeric device id is ever placed in
 * the URL. Falls back to the first device (online first) when the param is
 * missing or refers to a device the user does not have.
 */
export function useSelectedDevice(devices: DeviceResponse[] | undefined) {
  const [searchParams, setSearchParams] = useSearchParams()
  const raw = searchParams.get('device')
  const requestedId = raw !== null && /^\d+$/.test(raw) ? Number(raw) : null

  const sorted = useMemo(() => (devices ? sortDevicesForOps(devices) : []), [devices])
  const requested = requestedId !== null ? sorted.find((d) => d.id === requestedId) : undefined
  const selected = requested ?? sorted[0] ?? null

  /** True when the URL named a device that is not in the user's list. */
  const requestedMissing = devices !== undefined && requestedId !== null && !requested

  const select = useCallback(
    (deviceId: number) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          next.set('device', String(deviceId))
          return next
        },
        { replace: true },
      )
    },
    [setSearchParams],
  )

  // Write the default selection into the URL once devices are known.
  useEffect(() => {
    if (devices && selected && requestedId === null) select(selected.id)
  }, [devices, selected, requestedId, select])

  return { devices: sorted, selected, select, requestedMissing, requestedId }
}
