from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.device import Device
from app.models.user import User
from app.schemas.device import DeviceCreate
from app.repositories import device_repository


# ----------------------------------------
# Create Device
# ----------------------------------------
def create_device(
    device: DeviceCreate,
    db: Session,
    current_user: User
):
    new_device = Device(
        name=device.name,
        status=device.status,
        owner_id=current_user.id
    )

    return device_repository.create_device(
        new_device,
        db
    )


# ----------------------------------------
# Get All Devices
# ----------------------------------------
def get_devices(
    db: Session
):
    return device_repository.get_devices(db)


# ----------------------------------------
# Get Single Device
# ----------------------------------------
def get_device(
    device_id: int,
    db: Session
):
    device = device_repository.get_device(
        device_id,
        db
    )

    if device is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Device not found"
        )

    return device


# ----------------------------------------
# Update Device
# ----------------------------------------
def update_device(
    device_id: int,
    device_data: DeviceCreate,
    db: Session
):
    device = device_repository.get_device(
        device_id,
        db
    )

    if device is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Device not found"
        )

    device.name = device_data.name
    device.status = device_data.status

    return device_repository.update_device(
        device,
        db
    )


# ----------------------------------------
# Delete Device
# ----------------------------------------
def delete_device(
    device_id: int,
    db: Session
):
    device = device_repository.get_device(
        device_id,
        db
    )

    if device is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Device not found"
        )

    device_repository.delete_device(
        device,
        db
    )