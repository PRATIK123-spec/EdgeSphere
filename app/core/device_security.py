from fastapi import Depends, Header, HTTPException, status
from sqlalchemy.orm import Session

from app.database.dependencies import get_db
from app.models.device import Device
from app.repositories import device_repository
from app.utils.device_identity import hash_device_key

# Generous upper bound; real keys are 68 characters ("edg_" + 64 hex).
_MAX_KEY_LENGTH = 256


def get_current_device(
    x_device_key: str | None = Header(default=None),
    db: Session = Depends(get_db)
) -> Device:
    """
    Authenticate an IoT device using its device API key.

    Only the SHA-256 hash of the presented key is used: it is looked up
    against the unique key_hash column, so raw keys are never stored and
    never compared. The device identity always comes from the key, never
    from anything else the device sends.
    """
    if not x_device_key or len(x_device_key) > _MAX_KEY_LENGTH:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid Device API Key"
        )

    device = device_repository.get_by_key_hash(
        hash_device_key(x_device_key),
        db
    )

    if device is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid Device API Key"
        )

    return device
