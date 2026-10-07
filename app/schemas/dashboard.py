from datetime import datetime

from pydantic import BaseModel


class DeviceCounts(BaseModel):
    total: int
    online: int
    offline: int
    # Registered but never reported telemetry (last_seen is NULL).
    never_seen: int


class AlertCounts(BaseModel):
    # Open alerts = active + acknowledged.
    active_critical: int
    active_high: int
    active_total: int
    acknowledged: int
    # Distinct devices with any alert raised in the last 24 hours.
    devices_with_recent_alerts: int


class HourlyActivity(BaseModel):
    hour_start: datetime
    readings: int


class TelemetryActivity(BaseModel):
    readings_last_hour: int
    readings_last_24h: int
    last_reading_at: datetime | None
    # 24 hourly buckets, oldest first, ending with the current hour.
    hourly: list[HourlyActivity]


class DashboardSummary(BaseModel):
    generated_at: datetime
    devices: DeviceCounts
    alerts: AlertCounts
    telemetry: TelemetryActivity
