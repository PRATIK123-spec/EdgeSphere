from datetime import datetime

from sqlalchemy import BigInteger, cast, extract, func, literal, select
from sqlalchemy.orm import Session

from app.models.telemetry import Telemetry


# ----------------------------------------
# Create Telemetry
# ----------------------------------------
def create_telemetry(
    telemetry: Telemetry,
    db: Session
):
    db.add(telemetry)
    db.commit()
    db.refresh(telemetry)

    return telemetry


# ----------------------------------------
# Get Telemetry By ID
# ----------------------------------------
def get_telemetry(
    telemetry_id: int,
    db: Session
):
    statement = select(Telemetry).where(
        Telemetry.id == telemetry_id
    )

    result = db.execute(statement)

    return result.scalar_one_or_none()


def _range_filters(
    device_id: int,
    since: datetime | None,
    until: datetime | None,
):
    filters = [Telemetry.device_id == device_id]
    if since is not None:
        filters.append(Telemetry.created_at >= since)
    if until is not None:
        filters.append(Telemetry.created_at <= until)
    return filters


# ----------------------------------------
# Get Device History (one page, newest first)
# ----------------------------------------
def get_device_history(
    device_id: int,
    db: Session,
    *,
    limit: int,
    offset: int = 0,
    since: datetime | None = None,
    until: datetime | None = None,
) -> list[Telemetry]:
    statement = (
        select(Telemetry)
        .where(*_range_filters(device_id, since, until))
        .order_by(Telemetry.created_at.desc(), Telemetry.id.desc())
        .limit(limit)
        .offset(offset)
    )

    result = db.execute(statement)

    return list(result.scalars().all())


def count_device_history(
    device_id: int,
    db: Session,
    *,
    since: datetime | None = None,
    until: datetime | None = None,
) -> int:
    statement = select(func.count(Telemetry.id)).where(*_range_filters(device_id, since, until))
    return db.execute(statement).scalar_one()


def get_first_reading_time(device_id: int, db: Session) -> datetime | None:
    return db.execute(
        select(func.min(Telemetry.created_at)).where(Telemetry.device_id == device_id)
    ).scalar_one()


# ----------------------------------------
# Time-bucketed aggregates for charts
# ----------------------------------------
def get_device_series(
    device_id: int,
    db: Session,
    *,
    since: datetime,
    until: datetime,
    bucket_seconds: int,
):
    """
    Aggregate readings in [since, until] into fixed-width buckets, entirely
    in SQL. Bucket index = (epoch(created_at) - epoch(since)) // width,
    which compiles portably for PostgreSQL and SQLite.
    Returns rows ordered by bucket: (bucket, count, avg/min/max per metric).
    """
    start_epoch = int(since.timestamp()) if since.tzinfo else int(
        (since - datetime(1970, 1, 1)).total_seconds()
    )
    epoch = cast(extract("epoch", Telemetry.created_at), BigInteger)
    bucket = ((epoch - literal(start_epoch, BigInteger)) // literal(bucket_seconds, BigInteger)).label("bucket")

    columns = [bucket, func.count(Telemetry.id).label("count")]
    for name in ("temperature", "battery", "cpu_usage", "ram_usage"):
        column = getattr(Telemetry, name)
        columns += [
            func.avg(column).label(f"avg_{name}"),
            func.min(column).label(f"min_{name}"),
            func.max(column).label(f"max_{name}"),
        ]

    statement = (
        select(*columns)
        .where(*_range_filters(device_id, since, until))
        .group_by(bucket)
        .order_by(bucket)
    )

    return db.execute(statement).all()


# ----------------------------------------
# Get Latest Telemetry
# ----------------------------------------
def get_latest(
    device_id: int,
    db: Session
):
    statement = (
        select(Telemetry)
        .where(Telemetry.device_id == device_id)
        .order_by(Telemetry.created_at.desc(), Telemetry.id.desc())
        .limit(1)
    )

    result = db.execute(statement)

    return result.scalar_one_or_none()


# ----------------------------------------
# Delete Telemetry
# ----------------------------------------
def delete_telemetry(
    telemetry: Telemetry,
    db: Session
):
    db.delete(telemetry)
    db.commit()
