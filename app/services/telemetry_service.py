from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.telemetry import Telemetry
from app.models.user import User
from app.repositories import (
    device_repository,
    telemetry_repository,
)
from app.schemas.telemetry import TelemetryCreate
from app.services.device_service import require_owned_device
from app.services import alert_service


def create_telemetry(
    device_id: int,
    telemetry_data: TelemetryCreate,
    db: Session
):
    device = device_repository.get_device(
        device_id,
        db
    )

    if device is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Device not found"
        )

    telemetry = Telemetry(
        device_id=device_id,
        temperature=telemetry_data.temperature,
        battery=telemetry_data.battery,
        cpu_usage=telemetry_data.cpu_usage,
        ram_usage=telemetry_data.ram_usage,
    )

    created = telemetry_repository.create_telemetry(
        telemetry,
        db
    )

    device_repository.update_last_seen(
        device,
        db
    )

    alert_service.create_alerts_for_telemetry(
        device_id,
        created,
        db
    )

    return created


def get_history(
    device_id: int,
    db: Session,
    current_user: User
):
    require_owned_device(
        device_id,
        current_user,
        db
    )

    return telemetry_repository.get_device_history(
        device_id,
        db
    )


def get_latest(
    device_id: int,
    db: Session,
    current_user: User
):
    require_owned_device(
        device_id,
        current_user,
        db
    )

    return telemetry_repository.get_latest(
        device_id,
        db
    )


def delete(
    telemetry_id: int,
    db: Session,
    current_user: User
):
    telemetry = telemetry_repository.get_telemetry(
        telemetry_id,
        db
    )

    if telemetry is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Telemetry not found"
        )

    require_owned_device(
        telemetry.device_id,
        current_user,
        db
    )

    telemetry_repository.delete_telemetry(
        telemetry,
        db
    )

    return {
        "message": "Telemetry deleted successfully"
    }
