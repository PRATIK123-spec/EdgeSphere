from sqlalchemy.orm import Session

from app.models.notification_settings import NotificationSettings


def get_settings(
    user_id: int,
    db: Session
) -> NotificationSettings | None:
    return db.get(NotificationSettings, user_id)


def save_settings(
    settings_row: NotificationSettings,
    db: Session
) -> NotificationSettings:
    db.add(settings_row)
    db.commit()
    db.refresh(settings_row)

    return settings_row
