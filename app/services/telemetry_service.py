import math
from dataclasses import dataclass
from datetime import datetime, timedelta

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.device import Device
from app.models.telemetry import Telemetry
from app.models.user import User
from app.realtime import events
from app.repositories import (
    device_repository,
    telemetry_repository,
)
from app.schemas.telemetry import TelemetryCreate, TelemetrySeriesPoint, TelemetrySeriesResponse
from app.services.device_service import require_owned_device
from app.services import alert_service
from app.utils.time import utc_now, validate_range


@dataclass
class TelemetryPage:
    items: list[Telemetry]
    total: int


def create_telemetry(
    device: Device,
    telemetry_data: TelemetryCreate,
    db: Session
):
    """
    Ingest one reading from an authenticated device: persist it, mark the
    device Online, evaluate alert rules (idempotently), then publish
    real-time events to the device owner only.
    """
    was_status = device.status

    telemetry = Telemetry(
        device_id=device.id,
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
        db,
        seen_at=created.created_at
    )

    alerts = alert_service.evaluate_reading(
        device.id,
        created,
        db
    )

    owner_id = device.owner_id
    events.publish_telemetry(owner_id, created)
    if was_status != device.status:
        events.publish_device_status(owner_id, device.id, device.status, device.last_seen)
    events.publish_alerts(owner_id, alerts, created=True)

    return created


def get_history(
    device_id: int,
    db: Session,
    current_user: User,
    *,
    limit: int,
    offset: int = 0,
    since: datetime | None = None,
    until: datetime | None = None,
) -> TelemetryPage:
    require_owned_device(
        device_id,
        current_user,
        db
    )

    validate_range(since, until)

    return TelemetryPage(
        items=telemetry_repository.get_device_history(
            device_id, db, limit=limit, offset=offset, since=since, until=until
        ),
        total=telemetry_repository.count_device_history(device_id, db, since=since, until=until),
    )


def get_series(
    device_id: int,
    db: Session,
    current_user: User,
    *,
    since: datetime | None,
    until: datetime | None,
    max_points: int,
) -> TelemetrySeriesResponse:
    """
    Chart data: readings in [since, until] aggregated server-side into at
    most `max_points` equal time buckets. `since` defaults to the device's
    first reading, `until` to now.
    """
    require_owned_device(device_id, current_user, db)
    validate_range(since, until)

    until = until or utc_now()
    if since is None:
        since = telemetry_repository.get_first_reading_time(device_id, db) or (until - timedelta(hours=1))
        since = min(since, until)

    span_seconds = max(1.0, (until - since).total_seconds())
    bucket_seconds = max(1, math.ceil(span_seconds / max_points))

    rows = telemetry_repository.get_device_series(
        device_id, db, since=since, until=until, bucket_seconds=bucket_seconds
    )

    points = [
        TelemetrySeriesPoint(
            bucket_start=since + timedelta(seconds=int(row.bucket) * bucket_seconds),
            count=row.count,
            avg_temperature=float(row.avg_temperature),
            min_temperature=float(row.min_temperature),
            max_temperature=float(row.max_temperature),
            avg_battery=float(row.avg_battery),
            min_battery=float(row.min_battery),
            max_battery=float(row.max_battery),
            avg_cpu_usage=float(row.avg_cpu_usage),
            min_cpu_usage=float(row.min_cpu_usage),
            max_cpu_usage=float(row.max_cpu_usage),
            avg_ram_usage=float(row.avg_ram_usage),
            min_ram_usage=float(row.min_ram_usage),
            max_ram_usage=float(row.max_ram_usage),
        )
        for row in rows
    ]

    return TelemetrySeriesResponse(
        device_id=device_id,
        since=since,
        until=until,
        bucket_seconds=bucket_seconds,
        readings=sum(p.count for p in points),
        points=points,
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

    # Alerts raised by this reading keep existing (telemetry_id -> NULL).
    telemetry_repository.delete_telemetry(
        telemetry,
        db
    )

    return {
        "message": "Telemetry deleted successfully"
    }
