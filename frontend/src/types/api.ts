/**
 * TypeScript mirrors of the FastAPI Pydantic schemas in app/schemas/.
 *
 * Datetimes are serialized by the backend as naive UTC ISO strings
 * (no trailing "Z"); always parse them with `parseApiDate` from lib/format.
 */

export type ApiDateTime = string

// ---------------------------------------------------------------- users

/** app/schemas/user.py → UserRegister */
export interface UserRegister {
  email: string
  password: string
  full_name: string
}

/** app/schemas/user.py → Token */
export interface Token {
  access_token: string
  token_type: string
}

/** app/schemas/user.py → UserResponse */
export interface UserResponse {
  id: number
  email: string
  full_name: string
  is_active: boolean
  is_admin: boolean
  created_at: ApiDateTime
}

// -------------------------------------------------------------- devices

/** Values the backend currently writes to Device.status. Stored as free text. */
export type KnownDeviceStatus = 'Online' | 'Offline' | 'Maintenance'
export type DeviceStatus = KnownDeviceStatus | (string & {})

/** app/schemas/device.py → DeviceCreate (also the PUT body) */
export interface DeviceCreate {
  display_name: string
  device_type: string
  manufacturer: string
  model: string
}

/** app/schemas/device.py → DeviceUpdate (PATCH: any subset) */
export type DeviceUpdate = Partial<DeviceCreate>

/** app/schemas/device.py → DeviceResponse (never includes the device key) */
export interface DeviceResponse {
  id: number
  display_name: string
  device_type: string
  manufacturer: string
  model: string
  serial_number: string
  firmware_version: string
  status: DeviceStatus
  /** null until the device reports telemetry for the first time */
  last_seen: ApiDateTime | null
  created_at: ApiDateTime
  /** Non-secret identifier of the current key, e.g. "edg_1a2b3c4d" */
  key_prefix: string
}

/** app/schemas/device.py → DeviceProvisionResponse (POST /devices/ and POST /devices/{id}/rotate-key only) */
export interface DeviceProvisionResponse {
  device: DeviceResponse
  device_key: string
}

// ------------------------------------------------------------ telemetry

/** app/schemas/telemetry.py → TelemetryCreate (device-authenticated) */
export interface TelemetryCreate {
  temperature: number
  battery: number
  cpu_usage: number
  ram_usage: number
}

/** app/schemas/telemetry.py → TelemetryResponse */
export interface TelemetryResponse {
  id: number
  device_id: number
  temperature: number
  battery: number
  cpu_usage: number
  ram_usage: number
  created_at: ApiDateTime
}

/** app/schemas/telemetry.py → TelemetrySeriesPoint (one aggregated time bucket) */
export interface TelemetrySeriesPoint {
  bucket_start: ApiDateTime
  count: number
  avg_temperature: number
  min_temperature: number
  max_temperature: number
  avg_battery: number
  min_battery: number
  max_battery: number
  avg_cpu_usage: number
  min_cpu_usage: number
  max_cpu_usage: number
  avg_ram_usage: number
  min_ram_usage: number
  max_ram_usage: number
}

/** app/schemas/telemetry.py → TelemetrySeriesResponse */
export interface TelemetrySeriesResponse {
  device_id: number
  since: ApiDateTime
  until: ApiDateTime
  bucket_seconds: number
  readings: number
  points: TelemetrySeriesPoint[]
}

// --------------------------------------------------------------- alerts

export type KnownAlertType = 'TEMPERATURE' | 'BATTERY' | 'CPU' | 'RAM'
export type KnownAlertSeverity = 'CRITICAL' | 'HIGH'
export type AlertStatus = 'active' | 'acknowledged' | 'resolved'

/** app/schemas/alert.py → AlertResponse */
export interface AlertResponse {
  id: number
  device_id: number
  /** Reading that raised the alert; null for legacy alerts or deleted readings */
  telemetry_id: number | null
  alert_type: KnownAlertType | (string & {})
  message: string
  severity: KnownAlertSeverity | (string & {})
  status: AlertStatus
  created_at: ApiDateTime
  acknowledged_at: ApiDateTime | null
  resolved_at: ApiDateTime | null
}

// ------------------------------------------------------------- dashboard

/** app/schemas/dashboard.py → DashboardSummary */
export interface DashboardSummary {
  generated_at: ApiDateTime
  devices: { total: number; online: number; offline: number; never_seen: number }
  alerts: {
    active_critical: number
    active_high: number
    active_total: number
    acknowledged: number
    devices_with_recent_alerts: number
  }
  telemetry: {
    readings_last_hour: number
    readings_last_24h: number
    last_reading_at: ApiDateTime | null
    hourly: { hour_start: ApiDateTime; readings: number }[]
  }
}

// ------------------------------------------------------------- realtime

/** WebSocket event envelope (app/realtime/events.py, protocol v1) */
interface RealtimeEnvelope<TType extends string, TData> {
  v: number
  type: TType
  device_id: number
  ts: ApiDateTime
  data: TData
}

export type RealtimeEvent =
  | RealtimeEnvelope<'telemetry', TelemetryResponse>
  | RealtimeEnvelope<'alert.created' | 'alert.updated', AlertResponse>
  | RealtimeEnvelope<'device.status', { status: DeviceStatus; last_seen: ApiDateTime | null }>
  | RealtimeEnvelope<'device.created' | 'device.updated', DeviceResponse>
  | RealtimeEnvelope<'device.deleted', null>

/** A page of a list endpoint; `total` comes from the X-Total-Count header. */
export interface Page<T> {
  items: T[]
  total: number
}

// ------------------------------------------------------------ analytics

/** app/schemas/analytics.py → DeviceAnalyticsResponse */
export interface DeviceAnalyticsResponse {
  device_id: number
  records: number
  average_temperature: number
  maximum_temperature: number
  minimum_temperature: number
  average_battery: number
  average_cpu: number
  average_ram: number
  last_updated: ApiDateTime | null
}

// ---------------------------------------------------------------- misc

/** GET / */
export interface RootResponse {
  message: string
}

/** FastAPI error bodies: HTTPException → string, validation (422) → list. */
export interface ValidationErrorItem {
  loc: (string | number)[]
  msg: string
  type: string
}

export interface ApiErrorBody {
  detail?: string | ValidationErrorItem[]
}
