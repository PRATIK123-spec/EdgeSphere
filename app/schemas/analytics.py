from datetime import datetime

from pydantic import BaseModel, ConfigDict


class DeviceAnalyticsResponse(BaseModel):
    device_id: int
    records: int
    average_temperature: float
    maximum_temperature: float
    minimum_temperature: float
    average_battery: float
    average_cpu: float
    average_ram: float
    last_updated: datetime | None

    model_config = ConfigDict(from_attributes=True)
