from fastapi import Depends, Header, HTTPException, status
from sqlalchemy.orm import Session

from app.database.dependencies import get_db
from app.models.device import Device
from app.repositories import device_repository


def get_current_device(
    x_device_key: str = Header(...),
    db: Session = Depends(get_db)
) -> Device:
    """
    Authenticate an IoT device using its device API key.
    """

    device = device_repository.get_by_device_key(
        x_device_key,
        db
    )

    if device is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid Device API Key"
        )

    return device