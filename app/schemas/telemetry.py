from datetime import datetime

from pydantic import BaseModel, ConfigDict


class TelemetryCreate(BaseModel):
    temperature: float
    battery: int
    cpu_usage: float
    ram_usage: float


class TelemetryResponse(BaseModel):
    id: int
    device_id: int
    temperature: float
    battery: int
    cpu_usage: float
    ram_usage: float
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
