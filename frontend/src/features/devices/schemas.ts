import { z } from 'zod'
import type { DeviceCreate, DeviceResponse } from '@/types/api'

/**
 * Mirrors DeviceCreate (app/schemas/device.py). The Pydantic schema has no
 * length rules, so limits come from the Device model columns
 * (String(100) / String(50)); exceeding them would fail in PostgreSQL.
 */
const required = (label: string, max: number) =>
  z
    .string()
    .trim()
    .min(1, `${label} is required`)
    .max(max, `${label} must be ${max} characters or fewer`)

export const deviceFormSchema = z.object({
  display_name: required('Display name', 100),
  device_type: required('Device type', 50),
  manufacturer: required('Manufacturer', 50),
  model: required('Model', 50),
})

export type DeviceFormValues = z.infer<typeof deviceFormSchema>

export const DEVICE_FIELD_LIMITS: Record<keyof DeviceFormValues, number> = {
  display_name: 100,
  device_type: 50,
  manufacturer: 50,
  model: 50,
}

export const EMPTY_DEVICE_FORM: DeviceFormValues = {
  display_name: '',
  device_type: '',
  manufacturer: '',
  model: '',
}

export function deviceToFormValues(device: DeviceResponse): DeviceFormValues {
  return {
    display_name: device.display_name,
    device_type: device.device_type,
    manufacturer: device.manufacturer,
    model: device.model,
  }
}

export function formValuesToPayload(values: DeviceFormValues): DeviceCreate {
  return {
    display_name: values.display_name.trim(),
    device_type: values.device_type.trim(),
    manufacturer: values.manufacturer.trim(),
    model: values.model.trim(),
  }
}

/** Suggestions only; the backend accepts any device type string. */
export const DEVICE_TYPE_SUGGESTIONS = [
  'ESP32',
  'Raspberry Pi',
  'Arduino',
  'Industrial PC',
  'Gateway',
  'Camera',
  'Smart Sensor',
  'PLC',
  'Laptop',
]
