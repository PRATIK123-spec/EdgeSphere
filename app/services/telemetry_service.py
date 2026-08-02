from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.telemetry import Telemetry
from app.schemas.telemetry import TelemetryCreate

from app.repositories import (
    telemetry_repository,
    device_repository,
)


# ----------------------------------------
# Create Telemetry
# ----------------------------------------
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

    return telemetry_repository.create_telemetry(
        telemetry,
        db
    )


# ----------------------------------------
# Get History
# ----------------------------------------
def get_history(
    device_id: int,
    db: Session
):
    return telemetry_repository.get_device_history(
        device_id,
        db
    )


# ----------------------------------------
# Get Latest
# ----------------------------------------
def get_latest(
    device_id: int,
    db: Session
):
    return telemetry_repository.get_latest(
        device_id,
        db
    )


# ----------------------------------------
# Delete Telemetry
# ----------------------------------------
def delete(
    telemetry_id: int,
    db: Session
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

    telemetry_repository.delete_telemetry(
        telemetry,
        db
    )

    return {
        "message": "Telemetry deleted successfully"
    }