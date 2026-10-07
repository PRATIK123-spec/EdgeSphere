from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.device import Device
from app.models.user import User
from app.realtime import events
from app.repositories import device_repository
from app.schemas.device import DeviceCreate, DeviceProvisionResponse, DeviceUpdate
from app.utils.device_identity import (
    generate_device_key,
    generate_serial_number,
)


def create_device(
    device: DeviceCreate,
    db: Session,
    current_user: User
):
    raw_key = generate_device_key()

    new_device = Device(
        display_name=device.display_name,
        device_type=device.device_type,
        manufacturer=device.manufacturer,
        model=device.model,
        serial_number=generate_serial_number(),
        device_key=raw_key,  # stored as hash + prefix only
        firmware_version="1.0.0",
        status="Offline",
        owner_id=current_user.id,
        last_seen=None,
    )

    created = device_repository.create_device(
        new_device,
        db
    )

    events.publish_device(current_user.id, created, kind="created")

    # The only time this key is ever returned.
    return DeviceProvisionResponse(
        device=created,
        device_key=raw_key,
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
    device_data: DeviceCreate | DeviceUpdate,
    db: Session,
    current_user: User
):
    """PUT (all fields) or PATCH (any subset). Only descriptive fields are editable."""
    device = require_owned_device(
        device_id,
        current_user,
        db
    )

    for field in ("display_name", "device_type", "manufacturer", "model"):
        if field in device_data.model_fields_set:
            setattr(device, field, getattr(device_data, field))

    updated = device_repository.update_device(
        device,
        db
    )

    events.publish_device(current_user.id, updated, kind="updated")

    return updated


def rotate_device_key(
    device_id: int,
    db: Session,
    current_user: User
) -> DeviceProvisionResponse:
    """
    Replace the device's key. The old key stops authenticating immediately
    (its hash is overwritten); the new raw key is returned exactly once.
    """
    device = require_owned_device(
        device_id,
        current_user,
        db
    )

    raw_key = generate_device_key()
    device.device_key = raw_key

    updated = device_repository.update_device(device, db)

    events.publish_device(current_user.id, updated, kind="updated")

    return DeviceProvisionResponse(device=updated, device_key=raw_key)


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

    # Telemetry and alerts are removed by ON DELETE CASCADE in the database.
    device_repository.delete_device(
        device,
        db
    )

    events.publish_device_deleted(current_user.id, device_id)
