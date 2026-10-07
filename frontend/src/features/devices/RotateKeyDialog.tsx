import { Suspense, lazy, useState } from 'react'
import { KeyRound, Loader2 } from 'lucide-react'
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
import { useRotateDeviceKey } from '@/features/devices/mutations'
import { getErrorMessage } from '@/lib/api-client'
import type { DeviceResponse } from '@/types/api'

const DeviceKeyRevealDialog = lazy(() =>
  import('@/features/devices/DeviceKeyRevealDialog').then((m) => ({ default: m.DeviceKeyRevealDialog })),
)

/**
 * Confirm → POST /devices/{id}/rotate-key → one-time reveal of the new key.
 * The new key lives only in this component's state until acknowledged.
 */
export function RotateKeyDialog({
  device,
  open,
  onOpenChange,
}: {
  device: DeviceResponse
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const rotate = useRotateDeviceKey()
  const [revealed, setRevealed] = useState<{ device: DeviceResponse; key: string } | null>(null)
  const pending = rotate.isPending

  const confirm = async () => {
    // Preload the reveal dialog so the new key is never waiting on the network.
    void import('@/features/devices/DeviceKeyRevealDialog')
    try {
      const result = await rotate.mutateAsync(device.id)
      setRevealed({ device: result.device, key: result.device_key })
      rotate.reset()
      onOpenChange(false)
      toast.success('Device key rotated', { description: 'The previous key no longer works.' })
    } catch (error) {
      toast.error('Could not rotate key', { description: getErrorMessage(error) })
    }
  }

  return (
    <>
      <AlertDialog open={open} onOpenChange={(next) => !pending && onOpenChange(next)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <div className="mb-2 flex size-10 items-center justify-center rounded-xl border border-status-warning/40 bg-status-warning/10">
              <KeyRound className="size-5 text-status-warning" aria-hidden="true" />
            </div>
            <AlertDialogTitle>Rotate the key for {device.display_name}?</AlertDialogTitle>
            <AlertDialogDescription>
              A new API key is generated and shown once. The current key (
              <span className="font-mono text-foreground">{device.key_prefix}…</span>) stops working
              immediately, so the device is rejected until it is updated with the new key. Telemetry and
              alerts are kept.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
            <Button onClick={() => void confirm()} disabled={pending}>
              {pending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <KeyRound aria-hidden="true" />}
              {pending ? 'Rotating…' : 'Rotate key'}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {revealed && (
        <Suspense fallback={null}>
          <DeviceKeyRevealDialog
            reason="rotated"
            device={revealed.device}
            deviceKey={revealed.key}
            onDone={() => setRevealed(null)}
          />
        </Suspense>
      )}
    </>
  )
}
