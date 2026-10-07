from dataclasses import dataclass
from datetime import datetime

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.alert import Alert
from app.models.device import Device


@dataclass
class AlertFilters:
    owner_id: int
    device_id: int | None = None
    severities: list[str] | None = None
    alert_types: list[str] | None = None
    statuses: list[str] | None = None
    since: datetime | None = None
    until: datetime | None = None


def create_alert(alert: Alert, db: Session):
    db.add(alert)
    db.commit()
    db.refresh(alert)
    return alert


def add_alerts_for_reading(alerts: list[Alert], db: Session) -> bool:
    """
    Insert alerts raised by one reading and commit together with any pending
    changes (the reading's evaluated flag). Returns False if the
    (telemetry_id, alert_type) unique constraint fired, i.e. a concurrent
    evaluation already stored them; the transaction is rolled back.
    """
    db.add_all(alerts)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        return False
    for alert in alerts:
        db.refresh(alert)
    return True


def get_alert(alert_id: int, db: Session):
    return db.get(Alert, alert_id)


def get_owned_alert(alert_id: int, owner_id: int, db: Session) -> Alert | None:
    """The alert, only if it belongs to a device owned by `owner_id`."""
    statement = (
        select(Alert)
        .join(Device, Device.id == Alert.device_id)
        .where(Alert.id == alert_id, Device.owner_id == owner_id)
    )
    return db.execute(statement).scalar_one_or_none()


def get_latest_by_type(
    device_id: int,
    alert_type: str,
    db: Session
):
    statement = (
        select(Alert)
        .where(
            Alert.device_id == device_id,
            Alert.alert_type == alert_type,
        )
        .order_by(Alert.created_at.desc())
        .limit(1)
    )

    return db.execute(statement).scalar_one_or_none()


def _filtered(filters: AlertFilters):
    """Base WHERE clause; always scoped to the owner's devices."""
    conditions = [Device.owner_id == filters.owner_id]
    if filters.device_id is not None:
        conditions.append(Alert.device_id == filters.device_id)
    if filters.severities:
        conditions.append(func.upper(Alert.severity).in_([s.upper() for s in filters.severities]))
    if filters.alert_types:
        conditions.append(func.upper(Alert.alert_type).in_([t.upper() for t in filters.alert_types]))
    if filters.statuses:
        conditions.append(Alert.status.in_(filters.statuses))
    if filters.since is not None:
        conditions.append(Alert.created_at >= filters.since)
    if filters.until is not None:
        conditions.append(Alert.created_at <= filters.until)
    return conditions


def list_alerts(filters: AlertFilters, db: Session, *, limit: int, offset: int = 0) -> list[Alert]:
    statement = (
        select(Alert)
        .join(Device, Device.id == Alert.device_id)
        .where(*_filtered(filters))
        .order_by(Alert.created_at.desc(), Alert.id.desc())
        .limit(limit)
        .offset(offset)
    )
    return list(db.execute(statement).scalars().all())


def count_alerts(filters: AlertFilters, db: Session) -> int:
    statement = (
        select(func.count(Alert.id))
        .join(Device, Device.id == Alert.device_id)
        .where(*_filtered(filters))
    )
    return db.execute(statement).scalar_one()


def save(alert: Alert, db: Session) -> Alert:
    db.commit()
    db.refresh(alert)
    return alert
