from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class TelemetryCreate(BaseModel):
    """Reading posted by a device. Bounds reject physically impossible values."""

    temperature: float = Field(ge=-100, le=250, allow_inf_nan=False)
    battery: int = Field(ge=0, le=100)
    cpu_usage: float = Field(ge=0, le=100, allow_inf_nan=False)
    ram_usage: float = Field(ge=0, le=100, allow_inf_nan=False)


class TelemetryResponse(BaseModel):
    id: int
    device_id: int
    temperature: float
    battery: int
    cpu_usage: float
    ram_usage: float
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class TelemetrySeriesPoint(BaseModel):
    """One time bucket of aggregated readings (count = readings in the bucket)."""

    bucket_start: datetime
    count: int
    avg_temperature: float
    min_temperature: float
    max_temperature: float
    avg_battery: float
    min_battery: float
    max_battery: float
    avg_cpu_usage: float
    min_cpu_usage: float
    max_cpu_usage: float
    avg_ram_usage: float
    min_ram_usage: float
    max_ram_usage: float


class TelemetrySeriesResponse(BaseModel):
    device_id: int
    since: datetime
    until: datetime
    bucket_seconds: int
    # Total readings in [since, until] (sum of point counts).
    readings: int
    points: list[TelemetrySeriesPoint]
