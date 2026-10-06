from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.device import Device
from app.models.user import User
from app.repositories import device_repository
from app.schemas.device import DeviceCreate, DeviceProvisionResponse
from app.utils.device_identity import (
    generate_device_key,
    generate_serial_number,
)


def create_device(
    device: DeviceCreate,
    db: Session,
    current_user: User
):
    new_device = Device(
        display_name=device.display_name,
        device_type=device.device_type,
        manufacturer=device.manufacturer,
        model=device.model,
        serial_number=generate_serial_number(),
        device_key=generate_device_key(),
        firmware_version="1.0.0",
        status="Offline",
        owner_id=current_user.id,
    )

    created = device_repository.create_device(
        new_device,
        db
    )

    return DeviceProvisionResponse(
        device=created,
        device_key=created.device_key,
    )


def get_devices(
    db: Session,
    current_user: User
):
    return device_repository.get_devices_by_owner(
        current_user.id,
        db
    )


def require_owned_device(
    device_id: int,
    current_user: User,
    db: Session
) -> Device:
    device = device_repository.get_by_id_and_owner(
        device_id,
        current_user.id,
        db
    )

    if device is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Device not found"
        )

    return device


def get_device(
    device_id: int,
    db: Session,
    current_user: User
):
    return require_owned_device(
        device_id,
        current_user,
        db
    )


def update_device(
    device_id: int,
    device_data: DeviceCreate,
    db: Session,
    current_user: User
):
    device = require_owned_device(
        device_id,
        current_user,
        db
    )

    device.display_name = device_data.display_name
    device.device_type = device_data.device_type
    device.manufacturer = device_data.manufacturer
    device.model = device_data.model

    return device_repository.update_device(
        device,
        db
    )


def delete_device(
    device_id: int,
    db: Session,
    current_user: User
):
    device = require_owned_device(
        device_id,
        current_user,
        db
    )

    device_repository.delete_device(
        device,
        db
    )
