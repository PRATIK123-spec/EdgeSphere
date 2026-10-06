from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.device_security import get_current_device
from app.core.security import get_current_user
from app.database.dependencies import get_db
from app.models.device import Device
from app.models.user import User
from app.schemas.telemetry import (
    TelemetryCreate,
    TelemetryResponse,
)
from app.services import telemetry_service

router = APIRouter(
    prefix="/telemetry",
    tags=["Telemetry"]
)


@router.post(
    "/",
    response_model=TelemetryResponse
)
def create_telemetry(
    telemetry: TelemetryCreate,
    current_device: Device = Depends(get_current_device),
    db: Session = Depends(get_db),
):
    return telemetry_service.create_telemetry(
        current_device.id,
        telemetry,
        db
    )


@router.get(
    "/latest/{device_id}",
    response_model=TelemetryResponse | None
)
def get_latest(
    device_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return telemetry_service.get_latest(
        device_id,
        db,
        current_user
    )


@router.get(
    "/{device_id}",
    response_model=list[TelemetryResponse]
)
def get_history(
    device_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return telemetry_service.get_history(
        device_id,
        db,
        current_user
    )


@router.delete(
    "/{telemetry_id}"
)
def delete_telemetry(
    telemetry_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return telemetry_service.delete(
        telemetry_id,
        db,
        current_user
    )
