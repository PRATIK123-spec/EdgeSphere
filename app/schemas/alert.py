from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict

AlertStatus = Literal["active", "acknowledged", "resolved"]


class AlertResponse(BaseModel):
    id: int
    device_id: int
    # Reading that raised the alert; NULL for legacy alerts or deleted readings.
    telemetry_id: int | None
    alert_type: str
    message: str
    severity: str
    status: AlertStatus
    created_at: datetime
    acknowledged_at: datetime | None
    resolved_at: datetime | None

    model_config = ConfigDict(from_attributes=True)
