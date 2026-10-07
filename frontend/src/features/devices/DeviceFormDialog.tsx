import { useEffect, useId, useRef } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { AlertCircle, Loader2 } from 'lucide-react'

import { FormField } from '@/components/common/FormField'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DEVICE_FIELD_LIMITS,
  DEVICE_TYPE_SUGGESTIONS,
  EMPTY_DEVICE_FORM,
  deviceFormSchema,
  formValuesToPayload,
  type DeviceFormValues,
} from '@/features/devices/schemas'
import { getErrorMessage, isApiError } from '@/lib/api-client'
import type { DeviceCreate } from '@/types/api'

const FIELDS = Object.keys(DEVICE_FIELD_LIMITS) as (keyof DeviceFormValues)[]

export interface DeviceFormDialogProps {
  mode: 'create' | 'edit'
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Initial values (edit mode). */
  initialValues?: DeviceFormValues
  /**
   * Performs the request. Throw to keep the dialog open; the error is shown
   * inline and mapped onto fields where the API reports them.
   */
  onSubmit: (payload: DeviceCreate) => Promise<void>
}

export function DeviceFormDialog({
  mode,
  open,
  onOpenChange,
  initialValues,
  onSubmit,
}: DeviceFormDialogProps) {
  const formId = useId()
  const suggestionsId = useId()

  const {
    register,
    handleSubmit,
    reset,
    setError,
    clearErrors,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<DeviceFormValues>({
    resolver: zodResolver(deviceFormSchema),
    defaultValues: initialValues ?? EMPTY_DEVICE_FORM,
  })

  // Reset only when the dialog opens. Background refetches of the device
  // must not wipe edits the user is in the middle of making.
  const initialRef = useRef(initialValues)
  useEffect(() => {
    initialRef.current = initialValues
  })
  useEffect(() => {
    if (open) reset(initialRef.current ?? EMPTY_DEVICE_FORM)
  }, [open, reset])

  const submit = handleSubmit(async (values) => {
    clearErrors('root')
    try {
      await onSubmit(formValuesToPayload(values))
    } catch (error) {
      if (isApiError(error) && error.status === 422) {
        let mapped = false
        for (const field of FIELDS) {
          const message = error.fieldErrors[field]
          if (message) {
            setError(field, { message })
            mapped = true
          }
        }
        if (mapped) return
      }
      if (isApiError(error) && error.status === 409) {
        setError('root', { message: `Conflict: ${error.message}` })
        return
      }
      setError('root', { message: getErrorMessage(error) })
    }
  })

  const isCreate = mode === 'create'

  return (
    <Dialog open={open} onOpenChange={(next) => !isSubmitting && onOpenChange(next)}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isCreate ? 'Register device' : 'Edit device'}</DialogTitle>
          <DialogDescription>
            {isCreate
              ? 'EdgeSphere assigns a serial number and a one-time device API key on registration.'
              : 'Update the descriptive details of this device. Status and firmware are managed by the platform.'}
          </DialogDescription>
        </DialogHeader>

        <form id={formId} onSubmit={submit} noValidate className="grid gap-4 sm:grid-cols-2">
          {errors.root?.message && (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm text-destructive sm:col-span-2"
            >
              <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              <span>{errors.root.message}</span>
            </div>
          )}

          <div className="sm:col-span-2">
            <FormField
              id={`${formId}-display_name`}
              label="Display name"
              placeholder="e.g. Substation Edge Node"
              autoFocus
              autoComplete="off"
              maxLength={DEVICE_FIELD_LIMITS.display_name}
              error={errors.display_name?.message}
              {...register('display_name')}
            />
          </div>

          <FormField
            id={`${formId}-device_type`}
            label="Device type"
            placeholder="e.g. Raspberry Pi"
            autoComplete="off"
            list={suggestionsId}
            maxLength={DEVICE_FIELD_LIMITS.device_type}
            error={errors.device_type?.message}
            {...register('device_type')}
          />
          <datalist id={suggestionsId}>
            {DEVICE_TYPE_SUGGESTIONS.map((type) => (
              <option key={type} value={type} />
            ))}
          </datalist>

          <FormField
            id={`${formId}-manufacturer`}
            label="Manufacturer"
            placeholder="e.g. Raspberry Pi Ltd"
            autoComplete="off"
            maxLength={DEVICE_FIELD_LIMITS.manufacturer}
            error={errors.manufacturer?.message}
            {...register('manufacturer')}
          />

          <div className="sm:col-span-2">
            <FormField
              id={`${formId}-model`}
              label="Model"
              placeholder="e.g. Pi 5"
              autoComplete="off"
              maxLength={DEVICE_FIELD_LIMITS.model}
              error={errors.model?.message}
              {...register('model')}
            />
          </div>
        </form>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button type="submit" form={formId} disabled={isSubmitting || (!isCreate && !isDirty)}>
            {isSubmitting && <Loader2 className="animate-spin" aria-hidden="true" />}
            {isCreate
              ? isSubmitting
                ? 'Registering…'
                : 'Register device'
              : isSubmitting
                ? 'Saving…'
                : 'Save changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
