from datetime import datetime

from pydantic import BaseModel, ConfigDict, model_validator

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

    model_config = ConfigDict(from_attributes=True)


class DeviceProvisionResponse(BaseModel):
    """Returned only by device creation and key rotation: the one time the raw key is shown."""

    device: DeviceResponse
    device_key: str

    model_config = ConfigDict(from_attributes=True)
