from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database.dependencies import get_db
from app.models.user import User
from app.schemas.device import DeviceCreate, DeviceResponse
from app.services import device_service
from app.core.security import get_current_user

router = APIRouter(
    prefix="/devices",
    tags=["Devices"]
)


# ----------------------------------------
# Create Device
# ----------------------------------------
@router.post(
    "/",
    response_model=DeviceResponse,
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


# ----------------------------------------
# Get All Devices
# ----------------------------------------
@router.get(
    "/",
    response_model=list[DeviceResponse]
)
def get_devices(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return device_service.get_devices(db)


# ----------------------------------------
# Get Device By ID
# ----------------------------------------
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
        db
    )


# ----------------------------------------
# Update Device
# ----------------------------------------
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
        db
    )


# ----------------------------------------
# Delete Device
# ----------------------------------------
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
        db
    )

    return