import { useEffect, useId } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { AlertCircle, Loader2, RotateCcw } from 'lucide-react'
import { toast } from 'sonner'
import { z } from 'zod'

import { FormField } from '@/components/common/FormField'
import { CardSkeleton, ErrorState } from '@/components/common/states'
import { Button } from '@/components/ui/button'
import { useDeviceThresholds } from '@/features/devices/hooks'
import { useUpdateDeviceThresholds } from '@/features/devices/mutations'
import { formatThreshold } from '@/features/telemetry/thresholds'
import { getErrorMessage, isApiError } from '@/lib/api-client'
import type { AlertThresholdValues, DeviceThresholdsUpdate } from '@/types/api'

type Field = keyof AlertThresholdValues

/** Mirrors LIMITS in app/core/alert_thresholds.py. */
const FIELDS: { name: Field; label: string; unit: string; rule: string; min: number; max: number }[] = [
  { name: 'temperature_max', label: 'Temperature', unit: '°C', rule: 'Critical alert above', min: -100, max: 250 },
  { name: 'battery_min', label: 'Battery', unit: '%', rule: 'High alert below', min: 0, max: 100 },
  { name: 'cpu_max', label: 'CPU', unit: '%', rule: 'High alert above', min: 0, max: 100 },
  { name: 'ram_max', label: 'Memory', unit: '%', rule: 'High alert above', min: 0, max: 100 },
]

// Inputs are strings; empty means "use the default".
const optionalNumber = (min: number, max: number) =>
  z
    .string()
    .trim()
    .refine((v) => v === '' || Number.isFinite(Number(v)), 'Enter a number')
    .refine((v) => v === '' || (Number(v) >= min && Number(v) <= max), `Must be between ${min} and ${max}`)

const schema = z.object(
  Object.fromEntries(FIELDS.map((f) => [f.name, optionalNumber(f.min, f.max)])) as Record<
    Field,
    ReturnType<typeof optionalNumber>
  >,
)
type FormValues = z.infer<typeof schema>

const EMPTY: FormValues = { temperature_max: '', battery_min: '', cpu_max: '', ram_max: '' }

function toFormValues(overrides: DeviceThresholdsUpdate): FormValues {
  return Object.fromEntries(
    FIELDS.map((f) => [f.name, overrides[f.name] === null ? '' : String(overrides[f.name])]),
  ) as FormValues
}

function toPayload(values: FormValues): DeviceThresholdsUpdate {
  return Object.fromEntries(
    FIELDS.map((f) => [f.name, values[f.name] === '' ? null : Number(values[f.name])]),
  ) as DeviceThresholdsUpdate
}

/**
 * Per-device alert thresholds (GET/PUT /devices/{id}/thresholds). Empty
 * fields use the platform default. Changes apply to new readings only.
 */
export function DeviceThresholdsCard({ deviceId }: { deviceId: number }) {
  const formId = useId()
  const query = useDeviceThresholds(deviceId)
  const update = useUpdateDeviceThresholds(deviceId)

  const {
    register,
    handleSubmit,
    reset,
    setError,
    clearErrors,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: EMPTY })

  // Load saved values; never overwrite edits in progress.
  const overrides = query.data?.overrides
  useEffect(() => {
    if (overrides && !isDirty) reset(toFormValues(overrides))
  }, [overrides, isDirty, reset])

  const save = async (payload: DeviceThresholdsUpdate, message: string) => {
    clearErrors('root')
    try {
      const result = await update.mutateAsync(payload)
      reset(toFormValues(result.overrides))
      toast.success(message)
    } catch (error) {
      if (isApiError(error) && error.status === 422) {
        let mapped = false
        for (const f of FIELDS) {
          const fieldError = error.fieldErrors[f.name]
          if (fieldError) {
            setError(f.name, { message: fieldError })
            mapped = true
          }
        }
        if (mapped) return
      }
      setError('root', { message: getErrorMessage(error) })
    }
  }

  const submit = handleSubmit((values) => save(toPayload(values), 'Alert thresholds saved'))

  if (query.isPending) return <CardSkeleton lines={4} />
  if (query.isError) return <ErrorState compact error={query.error} onRetry={() => void query.refetch()} />

  const { defaults, overrides: saved } = query.data
  const hasOverrides = FIELDS.some((f) => saved[f.name] !== null)

  return (
    <section className="surface p-5" aria-labelledby="thresholds-heading">
      <h2 id="thresholds-heading" className="text-sm font-semibold">
        Alert thresholds
      </h2>
      <p className="mb-4 text-xs text-muted-foreground">
        Leave a field empty to use the default. Changes apply to new readings.
      </p>

      <form id={formId} onSubmit={submit} noValidate className="space-y-4">
        {errors.root?.message && (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm text-destructive"
          >
            <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            {errors.root.message}
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          {FIELDS.map((f) => (
            <FormField
              key={f.name}
              id={`${formId}-${f.name}`}
              label={`${f.label} (${f.unit})`}
              type="number"
              inputMode="decimal"
              step="any"
              min={f.min}
              max={f.max}
              placeholder={formatThreshold(defaults[f.name])}
              error={errors[f.name]?.message}
              hint={
                saved[f.name] === null
                  ? `${f.rule} ${formatThreshold(defaults[f.name])} ${f.unit} (default)`
                  : `${f.rule} ${formatThreshold(saved[f.name]!)} ${f.unit}`
              }
              className="font-mono"
              {...register(f.name)}
            />
          ))}
        </div>

        <div className="flex flex-wrap justify-end gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={!hasOverrides || isSubmitting}
            onClick={() => void save(toPayload(EMPTY), 'Alert thresholds reset to defaults')}
          >
            <RotateCcw aria-hidden="true" /> Use defaults
          </Button>
          <Button type="submit" size="sm" disabled={!isDirty || isSubmitting}>
            {isSubmitting && <Loader2 className="animate-spin" aria-hidden="true" />}
            Save thresholds
          </Button>
        </div>
      </form>
    </section>
  )
}
