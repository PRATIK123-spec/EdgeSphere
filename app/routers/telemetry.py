from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database.dependencies import get_db
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
    "/{device_id}",
    response_model=TelemetryResponse
)
def create_telemetry(
    device_id: int,
    telemetry: TelemetryCreate,
    db: Session = Depends(get_db),
):
    return telemetry_service.create_telemetry(
        device_id,
        telemetry,
        db
    )


@router.get(
    "/{device_id}",
    response_model=list[TelemetryResponse]
)
def get_history(
    device_id: int,
    db: Session = Depends(get_db),
):
    return telemetry_service.get_history(
        device_id,
        db
    )


@router.get(
    "/latest/{device_id}",
    response_model=TelemetryResponse | None
)
def get_latest(
    device_id: int,
    db: Session = Depends(get_db),
):
    return telemetry_service.get_latest(
        device_id,
        db
    )


@router.delete("/{telemetry_id}")
def delete_telemetry(
    telemetry_id: int,
    db: Session = Depends(get_db),
):
    return telemetry_service.delete(
        telemetry_id,
        db
    )