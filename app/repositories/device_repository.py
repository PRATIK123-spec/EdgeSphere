from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.device import Device


# ----------------------------------------
# Create Device
# ----------------------------------------
def create_device(
    device: Device,
    db: Session
):
    db.add(device)
    db.commit()
    db.refresh(device)

    return device


# ----------------------------------------
# Get All Devices
# ----------------------------------------
def get_devices(
    db: Session
):
    statement = select(Device)

    result = db.execute(statement)

    return result.scalars().all()


# ----------------------------------------
# Get Device By ID
# ----------------------------------------
def get_device(
    device_id: int,
    db: Session
):
    statement = select(Device).where(
        Device.id == device_id
    )

    result = db.execute(statement)

    return result.scalar_one_or_none()


# ----------------------------------------
# Update Device
# ----------------------------------------
def update_device(
    device: Device,
    db: Session
):
    db.commit()
    db.refresh(device)

    return device


# ----------------------------------------
# Delete Device
# ----------------------------------------
def delete_device(
    device: Device,
    db: Session
):
    db.delete(device)
    db.commit()


# ----------------------------------------
# Get Device By ID And Owner
# ----------------------------------------
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