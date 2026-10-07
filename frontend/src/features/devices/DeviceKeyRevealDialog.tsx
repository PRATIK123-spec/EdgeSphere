import { useId, useRef, useState } from 'react'
import { Check, CircleCheck, Copy, KeyRound, ShieldAlert } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import type { DeviceResponse } from '@/types/api'

/**
 * One-time display of a newly provisioned device API key.
 *
 * Security notes:
 * - The key exists only in the parent's component state while this dialog is
 *   open; the parent discards it on `onDone`.
 * - It is never logged, never put in a toast, and never written to the query cache.
 * - The dialog cannot be dismissed by Escape or outside click, only by
 *   explicitly confirming the key has been stored.
 */
export function DeviceKeyRevealDialog({
  device,
  deviceKey,
  onDone,
  reason = 'created',
}: {
  device: DeviceResponse
  deviceKey: string
  onDone: () => void
  /** 'created' after registration, 'rotated' after a key rotation. */
  reason?: 'created' | 'rotated'
}) {
  const [copied, setCopied] = useState(false)
  const [acknowledged, setAcknowledged] = useState(false)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const ackId = useId()

  const selectKey = () => {
    inputRef.current?.focus()
    inputRef.current?.select()
  }

  const copy = async () => {
    try {
      if (!navigator.clipboard) throw new Error('Clipboard API unavailable')
      await navigator.clipboard.writeText(deviceKey)
      setCopied(true)
      toast.success('Device key copied to clipboard')
      window.setTimeout(() => setCopied(false), 2500)
    } catch {
      // Fall back to manual copy; never include the key in the message.
      selectKey()
      toast.error('Could not access the clipboard', {
        description: 'The key is selected. Press Ctrl+C (⌘C on macOS) to copy it.',
      })
    }
  }

  return (
    <Dialog open onOpenChange={() => undefined}>
      <DialogContent
        showCloseButton={false}
        className="sm:max-w-xl"
        onEscapeKeyDown={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader className="pr-0">
          <div className="mb-2 flex size-10 items-center justify-center rounded-xl border border-status-online/30 bg-status-online/10">
            <CircleCheck className="size-5 text-status-online" aria-hidden="true" />
          </div>
          <DialogTitle>{reason === 'rotated' ? 'New device key issued' : 'Device registered'}</DialogTitle>
          <DialogDescription>
            {reason === 'rotated' ? (
              <>
                The previous key for <span className="font-medium text-foreground">{device.display_name}</span> no
                longer works. Update the device with the new key below.
              </>
            ) : (
              <>
                <span className="font-medium text-foreground">{device.display_name}</span> has been provisioned.
                Configure the device with the API key below.
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        <dl className="grid grid-cols-2 gap-3 rounded-lg border bg-background/40 p-3 text-xs">
          <div>
            <dt className="text-muted-foreground">Serial number</dt>
            <dd className="mt-0.5 font-mono">{device.serial_number}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Device ID</dt>
            <dd className="mt-0.5 font-mono">{device.id}</dd>
          </div>
        </dl>

        <div className="space-y-2">
          <Label htmlFor={`${ackId}-key`} className="flex items-center gap-1.5">
            <KeyRound className="size-3.5 text-primary" aria-hidden="true" />
            Device API key
          </Label>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-stretch">
            {/* Full key, wrapped, read-only; focusing selects it for manual copy. */}
            <textarea
              ref={inputRef}
              id={`${ackId}-key`}
              readOnly
              rows={2}
              value={deviceKey}
              onFocus={(e) => e.currentTarget.select()}
              autoComplete="off"
              spellCheck={false}
              data-1p-ignore
              data-lpignore="true"
              aria-describedby={`${ackId}-warning`}
              className="min-w-0 flex-1 resize-none rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 font-mono text-xs leading-relaxed break-all text-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            />
            <Button
              type="button"
              variant={copied ? 'secondary' : 'default'}
              className="h-auto min-h-10 shrink-0 px-4"
              onClick={() => void copy()}
            >
              {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
              {copied ? 'Copied' : 'Copy'}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Devices send it as the{' '}
            <code className="rounded bg-muted px-1 py-0.5 font-mono text-[11px]">X-DEVICE-KEY</code>{' '}
            header when posting to{' '}
            <code className="rounded bg-muted px-1 py-0.5 font-mono text-[11px]">POST /telemetry/</code>.
          </p>
        </div>

        <div
          id={`${ackId}-warning`}
          role="note"
          className="flex gap-3 rounded-lg border border-status-warning/40 bg-status-warning/10 p-3"
        >
          <ShieldAlert className="mt-0.5 size-4 shrink-0 text-status-warning" aria-hidden="true" />
          <div className="text-xs">
            <p className="font-semibold text-foreground">This key will not be shown again.</p>
            <p className="mt-1 text-muted-foreground">
              EdgeSphere cannot display or recover it after you close this dialog. Store it in a
              secrets manager or the device&apos;s secure configuration now. If it is lost, rotate
              the key from the device page to issue a new one.
            </p>
          </div>
        </div>

        <div className="flex items-start gap-2.5">
          <Checkbox
            id={ackId}
            checked={acknowledged}
            onCheckedChange={(value) => setAcknowledged(value === true)}
            className="mt-0.5"
          />
          <Label htmlFor={ackId} className="text-sm leading-snug font-normal">
            I have copied and securely stored this device key.
          </Label>
        </div>

        <DialogFooter>
          <Button type="button" onClick={onDone} disabled={!acknowledged}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
