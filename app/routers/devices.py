from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.core.security import get_current_user
from app.database.dependencies import get_db
from app.models.user import User
from app.schemas.device import (
    DeviceCreate,
    DeviceProvisionResponse,
    DeviceResponse,
    DeviceThresholdsResponse,
    DeviceThresholdsUpdate,
    DeviceUpdate,
)
from app.services import device_service

router = APIRouter(
    prefix="/devices",
    tags=["Devices"]
)


@router.post(
    "/",
    response_model=DeviceProvisionResponse,
    status_code=status.HTTP_201_CREATED
)
def create_device(
    device: DeviceCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return device_service.create_device(
        device,
        db,
        current_user
    )


@router.get(
    "/",
    response_model=list[DeviceResponse]
)
def get_devices(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return device_service.get_devices(
        db,
        current_user
    )


@router.get(
    "/{device_id}",
    response_model=DeviceResponse
)
def get_device(
    device_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return device_service.get_device(
        device_id,
        db,
        current_user
    )


@router.put(
    "/{device_id}",
    response_model=DeviceResponse
)
def update_device(
    device_id: int,
    device: DeviceCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return device_service.update_device(
        device_id,
        device,
        db,
        current_user
    )


@router.patch(
    "/{device_id}",
    response_model=DeviceResponse
)
def patch_device(
    device_id: int,
    device: DeviceUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return device_service.update_device(
        device_id,
        device,
        db,
        current_user
    )


@router.get(
    "/{device_id}/thresholds",
    response_model=DeviceThresholdsResponse
)
def get_device_thresholds(
    device_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return device_service.get_thresholds(
        device_id,
        db,
        current_user
    )


@router.put(
    "/{device_id}/thresholds",
    response_model=DeviceThresholdsResponse
)
def update_device_thresholds(
    device_id: int,
    thresholds: DeviceThresholdsUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Replace all four overrides; omitted or null fields reset to the default."""
    return device_service.update_thresholds(
        device_id,
        thresholds,
        db,
        current_user
    )


@router.post(
    "/{device_id}/rotate-key",
    response_model=DeviceProvisionResponse
)
def rotate_device_key(
    device_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Issue a new device key; the old key stops working immediately.
    The new key is in this response only and can never be retrieved again."""
    return device_service.rotate_device_key(
        device_id,
        db,
        current_user
    )


@router.delete(
    "/{device_id}",
    status_code=status.HTTP_204_NO_CONTENT
)
def delete_device(
    device_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    device_service.delete_device(
        device_id,
        db,
        current_user
    )
