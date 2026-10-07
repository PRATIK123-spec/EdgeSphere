from datetime import datetime

from sqlalchemy import BigInteger, case, cast, distinct, extract, func, literal, select
from sqlalchemy.orm import Session

from app.models.alert import Alert
from app.models.device import Device
from app.models.telemetry import Telemetry


def device_counts(owner_id: int, db: Session):
    """(total, online, never_seen) for the owner's devices — one query."""
    statement = select(
        func.count(Device.id),
        func.coalesce(func.sum(case((Device.status == "Online", 1), else_=0)), 0),
        func.coalesce(func.sum(case((Device.last_seen.is_(None), 1), else_=0)), 0),
    ).where(Device.owner_id == owner_id)
    return db.execute(statement).one()


def open_alert_counts(owner_id: int, db: Session):
    """Rows of (severity, status, count) for open (active/acknowledged) alerts."""
    statement = (
        select(func.upper(Alert.severity), Alert.status, func.count(Alert.id))
        .join(Device, Device.id == Alert.device_id)
        .where(Device.owner_id == owner_id, Alert.status.in_(("active", "acknowledged")))
        .group_by(func.upper(Alert.severity), Alert.status)
    )
    return db.execute(statement).all()


def devices_with_alerts_since(owner_id: int, since: datetime, db: Session) -> int:
    statement = (
        select(func.count(distinct(Alert.device_id)))
        .join(Device, Device.id == Alert.device_id)
        .where(Device.owner_id == owner_id, Alert.created_at >= since)
    )
    return db.execute(statement).scalar_one()


def telemetry_activity(owner_id: int, since: datetime, hour_start: datetime, db: Session):
    """
    Readings since `since`, bucketed by hour relative to `hour_start`
    (bucket 0 = the hour starting at hour_start), plus the newest reading time.
    """
    start_epoch = int((hour_start - datetime(1970, 1, 1)).total_seconds())
    epoch = cast(extract("epoch", Telemetry.created_at), BigInteger)
    bucket = ((epoch - literal(start_epoch, BigInteger)) // literal(3600, BigInteger)).label("bucket")

    hourly = db.execute(
        select(bucket, func.count(Telemetry.id))
        .join(Device, Device.id == Telemetry.device_id)
        .where(Device.owner_id == owner_id, Telemetry.created_at >= since)
        .group_by(bucket)
    ).all()

    last_reading_at = db.execute(
        select(func.max(Telemetry.created_at))
        .join(Device, Device.id == Telemetry.device_id)
        .where(Device.owner_id == owner_id)
    ).scalar_one()

    return hourly, last_reading_at


def readings_since(owner_id: int, since: datetime, db: Session) -> int:
    statement = (
        select(func.count(Telemetry.id))
        .join(Device, Device.id == Telemetry.device_id)
        .where(Device.owner_id == owner_id, Telemetry.created_at >= since)
    )
    return db.execute(statement).scalar_one()
