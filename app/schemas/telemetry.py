from datetime import datetime

from pydantic import BaseModel, Field, ConfigDict


class TelemetryCreate(BaseModel):

    temperature: float = Field(
        ...,
        ge=-100,
        le=200
    )

    battery: int = Field(
        ...,
        ge=0,
        le=100
    )

    cpu_usage: float = Field(
        ...,
        ge=0,
        le=100
    )

    ram_usage: float = Field(
        ...,
        ge=0,
        le=100
    )


class TelemetryResponse(BaseModel):

    id: int
    device_id: int

    temperature: float
    battery: int
    cpu_usage: float
    ram_usage: float

    created_at: datetime

    model_config = ConfigDict(
        from_attributes=True
    )