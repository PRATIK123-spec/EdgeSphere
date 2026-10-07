import { useMemo } from 'react'
import { toast } from 'sonner'

import { DeviceFormDialog } from '@/features/devices/DeviceFormDialog'
import { useUpdateDevice } from '@/features/devices/mutations'
import { deviceToFormValues } from '@/features/devices/schemas'
import { getErrorMessage, isApiError } from '@/lib/api-client'
import type { DeviceCreate, DeviceResponse } from '@/types/api'

/** PUT /devices/{id} with the full DeviceCreate body. */
export function EditDeviceDialog({
  device,
  open,
  onOpenChange,
}: {
  device: DeviceResponse
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const updateDevice = useUpdateDevice(device.id)
  const initialValues = useMemo(() => deviceToFormValues(device), [device])

  const handleSubmit = async (payload: DeviceCreate) => {
    try {
      const updated = await updateDevice.mutateAsync(payload)
      toast.success('Device updated', { description: updated.display_name })
      onOpenChange(false)
    } catch (error) {
      if (isApiError(error) && error.status === 404) {
        toast.error('Device no longer exists', {
          description: 'It may have been deleted in another session.',
        })
        onOpenChange(false)
        return
      }
      toast.error('Could not update device', { description: getErrorMessage(error) })
      throw error // keep the dialog open with the inline error
    }
  }

  return (
    <DeviceFormDialog
      mode="edit"
      open={open}
      onOpenChange={onOpenChange}
      initialValues={initialValues}
      onSubmit={handleSubmit}
    />
  )
}
