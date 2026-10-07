import { Suspense, lazy, useCallback, useMemo, useState, type ReactNode } from 'react'
import { toast } from 'sonner'

import { useCreateDevice } from '@/features/devices/mutations'
import { RegisterDeviceContext } from '@/features/devices/register-device-context'
import type { DeviceCreate, DeviceResponse } from '@/types/api'

// Loaded on first use so the form/validation code stays out of the shell bundle.
const DeviceFormDialog = lazy(() =>
  import('@/features/devices/DeviceFormDialog').then((m) => ({ default: m.DeviceFormDialog })),
)
const DeviceKeyRevealDialog = lazy(() =>
  import('@/features/devices/DeviceKeyRevealDialog').then((m) => ({ default: m.DeviceKeyRevealDialog })),
)

interface Provisioned {
  device: DeviceResponse
  deviceKey: string
}

/**
 * Hosts the register-device flow (form → POST /devices/ → one-time key reveal)
 * once, inside the app shell. Pages only trigger it, so the key-reveal dialog
 * survives the page re-rendering after the device list refreshes.
 *
 * The device key lives only in this component's state until the user confirms
 * they have stored it.
 */
export function RegisterDeviceProvider({ children }: { children: ReactNode }) {
  const [formOpen, setFormOpen] = useState(false)
  // Mount the form only once it has been requested, then keep it mounted
  // so its close animation can run.
  const [formRequested, setFormRequested] = useState(false)
  const [provisioned, setProvisioned] = useState<Provisioned | null>(null)
  const createDevice = useCreateDevice()
  const { mutateAsync, reset } = createDevice

  const handleSubmit = useCallback(
    async (payload: DeviceCreate) => {
      const result = await mutateAsync(payload)
      // Copy the key out of the mutation result, then drop the result.
      setProvisioned({ device: result.device, deviceKey: result.device_key })
      reset()
      setFormOpen(false)
      toast.success('Device registered', { description: result.device.display_name })
    },
    [mutateAsync, reset],
  )

  const value = useMemo(
    () => ({
      openRegisterDevice: () => {
        // Fetch the key-reveal code now, so it is ready the instant the
        // device is created and the one-time key never waits on the network.
        void import('@/features/devices/DeviceKeyRevealDialog')
        setFormRequested(true)
        setFormOpen(true)
      },
    }),
    [],
  )

  return (
    <RegisterDeviceContext.Provider value={value}>
      {children}

      <Suspense fallback={null}>
        {formRequested && (
          <DeviceFormDialog
            mode="create"
            open={formOpen}
            onOpenChange={setFormOpen}
            onSubmit={handleSubmit}
          />
        )}

        {provisioned && (
          <DeviceKeyRevealDialog
            device={provisioned.device}
            deviceKey={provisioned.deviceKey}
            onDone={() => setProvisioned(null)}
          />
        )}
      </Suspense>
    </RegisterDeviceContext.Provider>
  )
}
