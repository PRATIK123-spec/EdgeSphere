from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.user import User
from app.repositories import analytics_repository
from app.schemas.analytics import DeviceAnalyticsResponse
from app.services.device_service import require_owned_device


def get_device_analytics(
    device_id: int,
    db: Session,
    current_user: User
):
    require_owned_device(
        device_id,
        current_user,
        db
    )

    result = analytics_repository.get_device_analytics(
        device_id,
        db
    )

    if result[0] == 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No telemetry found for this device"
        )

    return DeviceAnalyticsResponse(
        device_id=device_id,
        records=result[0],
        average_temperature=round(result[1], 2),
        maximum_temperature=result[2],
        minimum_temperature=result[3],
        average_battery=round(result[4], 2),
        average_cpu=round(result[5], 2),
        average_ram=round(result[6], 2),
        last_updated=result[7]
    )
