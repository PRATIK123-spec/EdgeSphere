from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.alert import Alert
from app.models.telemetry import Telemetry
from app.models.user import User
from app.repositories import (
    alert_repository,
    telemetry_repository,
)
from app.services.device_service import require_owned_device
from app.utils.time import utc_now


ALERT_RULES = (
    {
        "alert_type": "TEMPERATURE",
        "severity": "CRITICAL",
        "message": "Temperature exceeded 70°C",
        "triggered": lambda telemetry: telemetry.temperature > 70,
    },
    {
        "alert_type": "BATTERY",
        "severity": "HIGH",
        "message": "Battery below 20%",
        "triggered": lambda telemetry: telemetry.battery < 20,
    },
    {
        "alert_type": "CPU",
        "severity": "HIGH",
        "message": "CPU usage above 90%",
        "triggered": lambda telemetry: telemetry.cpu_usage > 90,
    },
    {
        "alert_type": "RAM",
        "severity": "HIGH",
        "message": "RAM usage above 90%",
        "triggered": lambda telemetry: telemetry.ram_usage > 90,
    },
)


def _is_in_cooldown(existing: Alert | None) -> bool:
    if existing is None or existing.created_at is None:
        return False

    age_seconds = (utc_now() - existing.created_at).total_seconds()
    return age_seconds < settings.ALERT_COOLDOWN_SECONDS


def create_alerts_for_telemetry(
    device_id: int,
    telemetry: Telemetry,
    db: Session,
) -> list[Alert]:
    saved = []

    for rule in ALERT_RULES:
        if not rule["triggered"](telemetry):
            continue

        existing = alert_repository.get_latest_by_type(
            device_id,
            rule["alert_type"],
            db,
        )

        if _is_in_cooldown(existing):
            continue

        saved.append(
            alert_repository.create_alert(
                Alert(
                    device_id=device_id,
                    alert_type=rule["alert_type"],
                    severity=rule["severity"],
                    message=rule["message"],
                ),
                db,
            )
        )

    return saved


def check_device(
    device_id: int,
    db: Session,
    current_user: User
):
    require_owned_device(
        device_id,
        current_user,
        db
    )

    telemetry = telemetry_repository.get_latest(
        device_id,
        db
    )

    if telemetry is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No telemetry found"
        )

    return create_alerts_for_telemetry(
        device_id,
        telemetry,
        db
    )


def get_alerts(
    device_id: int,
    db: Session,
    current_user: User
):
    require_owned_device(
        device_id,
        current_user,
        db
    )

    return alert_repository.get_alerts(
        device_id,
        db
    )


def delete(
    alert_id: int,
    db: Session,
    current_user: User
):
    alert = alert_repository.get_alert(
        alert_id,
        db
    )

    if alert is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Alert not found"
        )

    require_owned_device(
        alert.device_id,
        current_user,
        db
    )

    alert_repository.delete_alert(
        alert,
        db
    )

    return alert
