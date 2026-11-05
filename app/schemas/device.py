from datetime import datetime
from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.core.alert_thresholds import LIMITS
from app.schemas.common import BoundedText

# Limits match the devices table columns.
DisplayName = BoundedText(100)
ShortText = BoundedText(50)


class DeviceCreate(BaseModel):
    """Body for POST /devices/ and PUT /devices/{id} (all fields required)."""

    model_config = ConfigDict(extra="forbid")

    display_name: DisplayName
    device_type: ShortText
    manufacturer: ShortText
    model: ShortText


class DeviceUpdate(BaseModel):
    """Body for PATCH /devices/{id}: any subset of the editable fields."""

    model_config = ConfigDict(extra="forbid")

    display_name: DisplayName | None = None
    device_type: ShortText | None = None
    manufacturer: ShortText | None = None
    model: ShortText | None = None

    @model_validator(mode="after")
    def _at_least_one_field(self):
        if not self.model_fields_set:
            raise ValueError("Provide at least one field to update")
        for field in self.model_fields_set:
            if getattr(self, field) is None:
                raise ValueError(f"{field} cannot be null")
        return self


def _threshold(name: str):
    low, high = LIMITS[name]
    return Annotated[float, Field(ge=low, le=high, allow_inf_nan=False)]


class AlertThresholdValues(BaseModel):
    """Effective thresholds: temperature/CPU/RAM alert above, battery alert below."""

    temperature_max: float
    battery_min: float
    cpu_max: float
    ram_max: float


class DeviceThresholdsUpdate(BaseModel):
    """
    Body for PUT /devices/{id}/thresholds. Replaces all four overrides:
    a missing or null field means "use the default".
    """

    model_config = ConfigDict(extra="forbid")

    temperature_max: _threshold("temperature_max") | None = None
    battery_min: _threshold("battery_min") | None = None
    cpu_max: _threshold("cpu_max") | None = None
    ram_max: _threshold("ram_max") | None = None


class DeviceThresholdsResponse(BaseModel):
    device_id: int
    # What the alert engine uses for this device.
    effective: AlertThresholdValues
    # The device's own values; null = uses the default.
    overrides: DeviceThresholdsUpdate
    defaults: AlertThresholdValues


class DeviceResponse(BaseModel):
    id: int
    display_name: str
    device_type: str
    manufacturer: str
    model: str
    serial_number: str
    firmware_version: str
    status: str
    # NULL until the device reports telemetry for the first time.
    last_seen: datetime | None
    created_at: datetime
    # Non-secret identifier of the current key (e.g. "edg_1a2b3c4d").
    key_prefix: str
    # Effective alert thresholds (per-device overrides merged with defaults).
    alert_thresholds: AlertThresholdValues

    model_config = ConfigDict(from_attributes=True)


class DeviceProvisionResponse(BaseModel):
    """Returned only by device creation and key rotation: the one time the raw key is shown."""

    device: DeviceResponse
    device_key: str

    model_config = ConfigDict(from_attributes=True)
