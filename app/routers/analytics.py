from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.security import get_current_user
from app.database.dependencies import get_db
from app.models.user import User
from app.schemas.analytics import DeviceAnalyticsResponse
from app.services import analytics_service

router = APIRouter(
    prefix="/analytics",
    tags=["Analytics"]
)


@router.get(
    "/device/{device_id}",
    response_model=DeviceAnalyticsResponse
)
def get_device_analytics(
    device_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return analytics_service.get_device_analytics(
        device_id,
        db,
        current_user
    )
