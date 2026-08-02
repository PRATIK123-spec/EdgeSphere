from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models.alert import Alert
from app.repositories import (
    alert_repository,
    telemetry_repository
)


def check_device(device_id: int, db: Session):

    telemetry = telemetry_repository.get_latest(
        device_id,
        db
    )

    if telemetry is None:
        raise HTTPException(
            status_code=404,
            detail="No telemetry found"
        )

    alerts = []

    if telemetry.temperature > 70:
        alerts.append(
            Alert(
                device_id=device_id,
                alert_type="TEMPERATURE",
                severity="CRITICAL",
                message="Temperature exceeded 70°C"
            )
        )

    if telemetry.battery < 20:
        alerts.append(
            Alert(
                device_id=device_id,
                alert_type="BATTERY",
                severity="HIGH",
                message="Battery below 20%"
            )
        )

    if telemetry.cpu_usage > 90:
        alerts.append(
            Alert(
                device_id=device_id,
                alert_type="CPU",
                severity="HIGH",
                message="CPU usage above 90%"
            )
        )

    if telemetry.ram_usage > 90:
        alerts.append(
            Alert(
                device_id=device_id,
                alert_type="RAM",
                severity="HIGH",
                message="RAM usage above 90%"
            )
        )

    saved = []

    for alert in alerts:
        saved.append(
            alert_repository.create_alert(
                alert,
                db
            )
        )

    return saved


def get_alerts(device_id: int, db: Session):
    return alert_repository.get_alerts(
        device_id,
        db
    )


def delete(alert_id: int, db: Session):
    alert = alert_repository.delete_alert(
        alert_id,
        db
    )

    if alert is None:
        raise HTTPException(
            status_code=404,
            detail="Alert not found"
        )

    return alert