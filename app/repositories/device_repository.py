from datetime import timedelta

from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.models.device import Device
from app.utils.time import utc_now


def create_device(
    device: Device,
    db: Session
):
    db.add(device)
    db.commit()
    db.refresh(device)

    return device


def get_devices_by_owner(
    owner_id: int,
    db: Session
):
    statement = select(Device).where(
        Device.owner_id == owner_id
    )

    result = db.execute(statement)

    return result.scalars().all()


def get_device(
    device_id: int,
    db: Session
):
    statement = select(Device).where(
        Device.id == device_id
    )

    result = db.execute(statement)

    return result.scalar_one_or_none()


def get_by_id_and_owner(
    device_id: int,
    owner_id: int,
    db: Session
):
    statement = select(Device).where(
        Device.id == device_id,
        Device.owner_id == owner_id
    )

    result = db.execute(statement)

    return result.scalar_one_or_none()


def get_by_key_hash(
    key_hash: str,
    db: Session
):
    statement = select(Device).where(
        Device.key_hash == key_hash
    )

    result = db.execute(statement)

    return result.scalar_one_or_none()


def get_by_serial_number(
    serial_number: str,
    db: Session
):
    statement = select(Device).where(
        Device.serial_number == serial_number
    )

    result = db.execute(statement)

    return result.scalar_one_or_none()


def update_device(
    device: Device,
    db: Session
):
    db.commit()
    db.refresh(device)

    return device


def delete_device(
    device: Device,
    db: Session
):
    db.delete(device)
    db.commit()


def update_last_seen(
    device: Device,
    db: Session,
    seen_at=None
):
    device.last_seen = seen_at or utc_now()
    device.status = "Online"

    db.commit()
    db.refresh(device)

    return device


def set_stale_online_devices_offline(
    db: Session,
    offline_after_seconds: int
) -> list[tuple[int, int, object]]:
    """
    Flip Online devices that have not reported within the window to Offline.
    Returns (device_id, owner_id, last_seen) for every device that changed.
    """
    cutoff = utc_now() - timedelta(seconds=offline_after_seconds)

    statement = (
        update(Device)
        .where(
            Device.status == "Online",
            Device.last_seen < cutoff,
        )
        .values(status="Offline")
        .returning(Device.id, Device.owner_id, Device.last_seen)
    )

    changed = [tuple(row) for row in db.execute(statement).all()]
    db.commit()

    return changed


def mark_stale_online_devices_offline(
    db: Session,
    offline_after_seconds: int
) -> int:
    return len(set_stale_online_devices_offline(db, offline_after_seconds))
