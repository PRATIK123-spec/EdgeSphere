from dataclasses import dataclass

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.alert_thresholds import AlertThresholds, effective_thresholds
from app.core.config import settings
from app.models.alert import Alert
from app.models.telemetry import Telemetry
from app.models.user import User
from app.realtime import events
from app.repositories import (
    alert_repository,
    telemetry_repository,
)
from app.repositories.alert_repository import AlertFilters
from app.services.device_service import require_owned_device
from app.utils.time import utc_now


def _fmt(value: float) -> str:
    return f"{value:g}"  # 70.0 -> "70", 72.5 -> "72.5"


# Each rule compares one reading against the device's effective thresholds
# (per-device overrides, falling back to DEFAULT_THRESHOLDS).
ALERT_RULES = (
    {
        "alert_type": "TEMPERATURE",
        "severity": "CRITICAL",
        "message": lambda th: f"Temperature exceeded {_fmt(th.temperature_max)}°C",
        "triggered": lambda telemetry, th: telemetry.temperature > th.temperature_max,
    },
    {
        "alert_type": "BATTERY",
        "severity": "HIGH",
        "message": lambda th: f"Battery below {_fmt(th.battery_min)}%",
        "triggered": lambda telemetry, th: telemetry.battery < th.battery_min,
    },
    {
        "alert_type": "CPU",
        "severity": "HIGH",
        "message": lambda th: f"CPU usage above {_fmt(th.cpu_max)}%",
        "triggered": lambda telemetry, th: telemetry.cpu_usage > th.cpu_max,
    },
    {
        "alert_type": "RAM",
        "severity": "HIGH",
        "message": lambda th: f"RAM usage above {_fmt(th.ram_max)}%",
        "triggered": lambda telemetry, th: telemetry.ram_usage > th.ram_max,
    },
)


@dataclass
class AlertPage:
    items: list[Alert]
    total: int


def _is_in_cooldown(existing: Alert | None) -> bool:
    if existing is None or existing.created_at is None:
        return False

    age_seconds = (utc_now() - existing.created_at).total_seconds()
    return age_seconds < settings.ALERT_COOLDOWN_SECONDS


# ----------------------------------------------------------------- evaluation

def evaluate_reading(
    device_id: int,
    telemetry: Telemetry,
    db: Session,
    thresholds: AlertThresholds | None = None,
) -> list[Alert]:
    """
    Evaluate the alert rules for one reading, exactly once, against the
    device's thresholds (loaded from the reading's device when not given).

    Idempotency is guaranteed at two levels:
    - the reading's `alerts_evaluated` flag: an evaluated reading is never
      evaluated again (re-checks are no-ops);
    - UNIQUE (telemetry_id, alert_type): even concurrent evaluations of the
      same reading cannot store the same alert twice.
    The per-type cooldown still limits repeat alerts across readings.
    """
    if telemetry.alerts_evaluated:
        return []

    if thresholds is None:
        thresholds = effective_thresholds(telemetry.device)

    candidates = []
    for rule in ALERT_RULES:
        if not rule["triggered"](telemetry, thresholds):
            continue

        existing = alert_repository.get_latest_by_type(
            device_id,
            rule["alert_type"],
            db,
        )

        if _is_in_cooldown(existing):
            continue

        candidates.append(
            Alert(
                device_id=device_id,
                telemetry_id=telemetry.id,
                alert_type=rule["alert_type"],
                severity=rule["severity"],
                message=rule["message"](thresholds),
                status="active",
            )
        )

    telemetry.alerts_evaluated = True

    if not alert_repository.add_alerts_for_reading(candidates, db):
        # A concurrent evaluation of this reading won; it stored the alerts.
        return []

    return candidates


# Backwards-compatible name used by earlier code.
create_alerts_for_telemetry = evaluate_reading


def check_device(
    device_id: int,
    db: Session,
    current_user: User
):
    """
    POST /alerts/check/{device_id}: evaluate the latest reading if it has not
    been evaluated yet. Returns the alerts created (usually [] because
    ingestion already evaluates every reading). Never duplicates alerts.
    """
    device = require_owned_device(
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

    created = evaluate_reading(device.id, telemetry, db, effective_thresholds(device))
    events.publish_alerts(current_user.id, created, created=True)
    return created


# ------------------------------------------------------------------- queries

def list_alerts(
    filters: AlertFilters,
    db: Session,
    *,
    limit: int,
    offset: int,
) -> AlertPage:
    return AlertPage(
        items=alert_repository.list_alerts(filters, db, limit=limit, offset=offset),
        total=alert_repository.count_alerts(filters, db),
    )


def get_alerts(
    device_id: int,
    db: Session,
    current_user: User,
    filters: AlertFilters | None = None,
    *,
    limit: int,
    offset: int = 0,
) -> AlertPage:
    require_owned_device(
        device_id,
        current_user,
        db
    )

    filters = filters or AlertFilters(owner_id=current_user.id)
    filters.device_id = device_id
    return list_alerts(filters, db, limit=limit, offset=offset)


# ----------------------------------------------------------------- lifecycle

def _require_owned_alert(alert_id: int, db: Session, current_user: User) -> Alert:
    alert = alert_repository.get_owned_alert(alert_id, current_user.id, db)
    if alert is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Alert not found"
        )
    return alert


def acknowledge(alert_id: int, db: Session, current_user: User) -> Alert:
    alert = _require_owned_alert(alert_id, db, current_user)

    if alert.status == "resolved":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Alert is already resolved"
        )

    if alert.status == "acknowledged":
        return alert  # idempotent

    alert.status = "acknowledged"
    alert.acknowledged_at = utc_now()
    saved = alert_repository.save(alert, db)
    events.publish_alerts(current_user.id, [saved], created=False)
    return saved


def resolve(alert_id: int, db: Session, current_user: User) -> Alert:
    alert = _require_owned_alert(alert_id, db, current_user)

    if alert.status == "resolved":
        return alert  # idempotent

    alert.status = "resolved"
    alert.resolved_at = utc_now()
    saved = alert_repository.save(alert, db)
    events.publish_alerts(current_user.id, [saved], created=False)
    return saved


def delete(
    alert_id: int,
    db: Session,
    current_user: User
):
    """
    Alerts are an audit trail and the reference point for the per-type
    cooldown, so they are no longer deletable (deleting the newest alert of
    a type would silently reset the cooldown). Resolve them instead.
    Ownership is checked first so other users' alerts still 404.
    """
    _require_owned_alert(alert_id, db, current_user)

    raise HTTPException(
        status_code=status.HTTP_409_CONFLICT,
        detail="Alerts cannot be deleted. Resolve the alert instead."
    )
