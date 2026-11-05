from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.core.security import get_current_user
from app.database.dependencies import get_db
from app.models.user import User
from app.schemas.notification import (
    NotificationSettingsResponse,
    NotificationSettingsUpdate,
    NotificationTestResponse,
)
from app.schemas.user import UserResponse
from app.services import notification_service, user_service

router = APIRouter(
    prefix="/users",
    tags=["Users"]
)


@router.get(
    "/me",
    response_model=UserResponse
)
def get_my_profile(
    current_user: User = Depends(get_current_user)
):
    return user_service.get_current_user_profile(
        current_user
    )


@router.get(
    "/me/notifications",
    response_model=NotificationSettingsResponse
)
def get_my_notifications(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return notification_service.get_settings(db, current_user)


@router.put(
    "/me/notifications",
    response_model=NotificationSettingsResponse
)
def update_my_notifications(
    data: NotificationSettingsUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Replace the caller's alert notification settings. 409 if a channel is not configured."""
    return notification_service.update_settings(data, db, current_user)


@router.post(
    "/me/notifications/test",
    response_model=NotificationTestResponse,
    status_code=status.HTTP_202_ACCEPTED
)
def send_test_notification(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Queue a test message to the caller's enabled channels (once per 30 s)."""
    return notification_service.send_test(db, current_user)
