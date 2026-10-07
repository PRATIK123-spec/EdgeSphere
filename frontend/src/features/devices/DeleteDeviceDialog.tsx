import { useId, useState } from 'react'
import { Loader2, Trash2, TriangleAlert } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useDeleteDevice } from '@/features/devices/mutations'
import { getErrorMessage, isApiError } from '@/lib/api-client'
import type { DeviceResponse } from '@/types/api'

/**
 * DELETE /devices/{id}. The backend cascades the delete to every telemetry
 * record and alert for the device, and the device key stops working, so the
 * user must type the device name to confirm.
 */
export function DeleteDeviceDialog({
  device,
  open,
  onOpenChange,
  onDeleted,
}: {
  device: DeviceResponse
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Called after the device is gone (deleted now, or already deleted). */
  onDeleted?: () => void
}) {
  const [confirmation, setConfirmation] = useState('')
  const deleteDevice = useDeleteDevice()
  const inputId = useId()

  // Names can be blank if a device was created directly through the API.
  const expected = device.display_name.trim()
  const confirmed = expected === '' || confirmation.trim() === expected
  const pending = deleteDevice.isPending

  /** Clears the typed confirmation whenever the dialog closes. */
  const handleOpenChange = (next: boolean) => {
    if (pending) return
    if (!next) setConfirmation('')
    onOpenChange(next)
  }

  const handleDelete = async () => {
    try {
      await deleteDevice.mutateAsync(device.id)
      toast.success('Device deleted', { description: device.display_name })
      setConfirmation('')
      onOpenChange(false)
      onDeleted?.()
    } catch (error) {
      if (isApiError(error) && error.status === 404) {
        toast.info('Device was already deleted')
        setConfirmation('')
        onOpenChange(false)
        onDeleted?.()
        return
      }
      toast.error('Could not delete device', { description: getErrorMessage(error) })
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <div className="mb-2 flex size-10 items-center justify-center rounded-xl border border-destructive/30 bg-destructive/10">
            <Trash2 className="size-5 text-destructive" aria-hidden="true" />
          </div>
          <AlertDialogTitle>Delete {device.display_name || 'this device'}?</AlertDialogTitle>
          <AlertDialogDescription>
            This permanently removes the device from EdgeSphere. This cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="flex gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-xs">
          <TriangleAlert className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden="true" />
          <ul className="list-disc space-y-1 pl-4 text-muted-foreground marker:text-destructive/60">
            <li>
              <span className="text-foreground">All telemetry history</span> for this device is deleted.
            </li>
            <li>
              <span className="text-foreground">All alerts</span> raised for this device are deleted.
            </li>
            <li>
              Its <span className="text-foreground">device API key stops working</span> immediately.
            </li>
          </ul>
        </div>

        {expected !== '' && (
          <div className="space-y-2">
            <Label htmlFor={inputId} className="block text-sm leading-snug font-normal text-muted-foreground">
              Type <span className="font-mono font-medium text-foreground">{expected}</span> to confirm.
            </Label>
            <Input
              id={inputId}
              value={confirmation}
              onChange={(e) => setConfirmation(e.target.value)}
              autoComplete="off"
              spellCheck={false}
              className="h-9"
              disabled={pending}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && confirmed && !pending) void handleDelete()
              }}
            />
          </div>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
          <Button
            variant="destructive"
            className="bg-destructive text-white hover:bg-destructive/90 dark:bg-destructive dark:hover:bg-destructive/90"
            onClick={() => void handleDelete()}
            disabled={!confirmed || pending}
          >
            {pending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Trash2 aria-hidden="true" />}
            {pending ? 'Deleting…' : 'Delete device'}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
