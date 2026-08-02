from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database.dependencies import get_db
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
    db: Session = Depends(get_db)
):
    return analytics_service.get_device_analytics(
        device_id,
        db
    )