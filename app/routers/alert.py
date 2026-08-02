from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database.dependencies import get_db
from app.schemas.alert import AlertResponse
from app.services import alert_service

router = APIRouter(
    prefix="/alerts",
    tags=["Alerts"]
)


@router.post(
    "/check/{device_id}",
    response_model=list[AlertResponse]
)
def check_alerts(
    device_id: int,
    db: Session = Depends(get_db)
):
    return alert_service.check_device(
        device_id,
        db
    )


@router.get(
    "/{device_id}",
    response_model=list[AlertResponse]
)
def get_alerts(
    device_id: int,
    db: Session = Depends(get_db)
):
    return alert_service.get_alerts(
        device_id,
        db
    )


@router.delete("/{alert_id}")
def delete_alert(
    alert_id: int,
    db: Session = Depends(get_db)
):
    return alert_service.delete(
        alert_id,
        db
    )