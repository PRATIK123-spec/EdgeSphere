from datetime import datetime

from pydantic import BaseModel, ConfigDict


class DeviceCreate(BaseModel):
    display_name: str
    device_type: str
    manufacturer: str
    model: str


class DeviceResponse(BaseModel):
    id: int
    display_name: str
    device_type: str
    manufacturer: str
    model: str
    serial_number: str
    firmware_version: str
    status: str
    last_seen: datetime

    model_config = ConfigDict(from_attributes=True)


class DeviceProvisionResponse(BaseModel):
    device: DeviceResponse
    device_key: str

    model_config = ConfigDict(from_attributes=True)
