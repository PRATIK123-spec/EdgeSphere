from sqlalchemy import select
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


# ----------------------------------------
# Get Device History
# ----------------------------------------
def get_device_history(
    device_id: int,
    db: Session
):
    statement = (
        select(Telemetry)
        .where(Telemetry.device_id == device_id)
        .order_by(Telemetry.created_at.desc())
    )

    result = db.execute(statement)

    return result.scalars().all()


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
        .order_by(Telemetry.created_at.desc())
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