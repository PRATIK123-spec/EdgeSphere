from datetime import datetime

from pydantic import BaseModel, ConfigDict


class AlertResponse(BaseModel):
    id: int
    device_id: int
    alert_type: str
    message: str
    severity: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
