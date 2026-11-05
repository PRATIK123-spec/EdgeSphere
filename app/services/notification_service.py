"""
Alert notifications: per-user settings and fan-out of newly created alerts.

Only alerts that were actually created are notified, so the per-type alert
cooldown also limits notifications. Messages contain the device's display
name, never its key or serial number. Delivery is queued in the background
(app/notifications/dispatcher.py); failures are logged and never reach the
caller, so telemetry ingestion is never slowed down or broken by it.
"""

import logging
import threading
import time
from collections.abc import Sequence

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.alert import Alert
from app.models.device import Device
from app.models.notification_settings import NotificationSettings
from app.models.user import User
from app.notifications import dispatcher
from app.repositories import notification_repository, user_repository
from app.schemas.notification import (
    NotificationSettingsResponse,
    NotificationSettingsUpdate,
    NotificationTestResponse,
)
from app.utils.time import utc_now

logger = logging.getLogger(__name__)

SEVERITY_RANK = {"HIGH": 1, "CRITICAL": 2}

TEST_COOLDOWN_SECONDS = 30
_test_lock = threading.Lock()
_last_test_at: dict[int, float] = {}


# ------------------------------------------------------------------ settings

def _response(user: User, row: NotificationSettings | None) -> NotificationSettingsResponse:
    return NotificationSettingsResponse(
        email_enabled=bool(row and row.email_enabled),
        telegram_enabled=bool(row and row.telegram_enabled),
        telegram_chat_id=row.telegram_chat_id if row else None,
        min_severity=row.min_severity if row else "HIGH",
        email_address=user.email,
        email_available=settings.email_notifications_available,
        telegram_available=settings.telegram_notifications_available,
    )


def get_settings(db: Session, current_user: User) -> NotificationSettingsResponse:
    return _response(current_user, notification_repository.get_settings(current_user.id, db))


def update_settings(
    data: NotificationSettingsUpdate,
    db: Session,
    current_user: User,
) -> NotificationSettingsResponse:
    if data.email_enabled and not settings.email_notifications_available:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email notifications are not configured on this server",
        )
    if data.telegram_enabled and not settings.telegram_notifications_available:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Telegram notifications are not configured on this server",
        )

    row = notification_repository.get_settings(current_user.id, db) or NotificationSettings(user_id=current_user.id)
    row.email_enabled = data.email_enabled
    row.telegram_enabled = data.telegram_enabled
    row.telegram_chat_id = data.telegram_chat_id
    row.min_severity = data.min_severity

    return _response(current_user, notification_repository.save_settings(row, db))


# ------------------------------------------------------------------ delivery

def _recipients(user: User, row: NotificationSettings | None) -> dict[str, str]:
    """Channel -> address, for channels the user enabled and the server supports."""
    if row is None:
        return {}
    recipients = {}
    if row.email_enabled and settings.email_notifications_available:
        recipients["email"] = user.email
    if row.telegram_enabled and row.telegram_chat_id and settings.telegram_notifications_available:
        recipients["telegram"] = row.telegram_chat_id
    return recipients


def _device_link(device_id: int) -> str | None:
    base = settings.FRONTEND_URL.strip().rstrip("/")
    return f"{base}/devices/{device_id}" if base else None


def _alert_message(device: Device, alerts: Sequence[Alert]) -> tuple[str, str]:
    top = max(alerts, key=lambda a: SEVERITY_RANK.get(a.severity, 0))
    name = device.display_name
    if len(alerts) == 1:
        subject = f"[EdgeSphere] {top.severity}: {top.alert_type.title()} alert on {name}"
    else:
        subject = f"[EdgeSphere] {top.severity}: {len(alerts)} alerts on {name}"

    raised = (top.created_at or utc_now()).strftime("%Y-%m-%d %H:%M UTC")
    lines = [f"Device: {name}", f"Raised: {raised}", ""]
    lines += [f"- {a.severity} {a.alert_type}: {a.message}" for a in alerts]
    link = _device_link(device.id)
    if link:
        lines += ["", f"Open the device: {link}"]
    lines += ["", "You receive this because alert notifications are enabled in your EdgeSphere profile."]
    return subject, "\n".join(lines)


def notify_new_alerts(device: Device, alerts: Sequence[Alert], db: Session) -> None:
    """
    Queue notifications for alerts that were just created. Called during
    ingestion: it never raises and never waits for delivery.
    """
    try:
        if not alerts:
            return
        if not (settings.email_notifications_available or settings.telegram_notifications_available):
            return

        row = notification_repository.get_settings(device.owner_id, db)
        if row is None or not (row.email_enabled or row.telegram_enabled):
            return

        threshold = SEVERITY_RANK.get(row.min_severity, 1)
        relevant = [a for a in alerts if SEVERITY_RANK.get(a.severity, 0) >= threshold]
        if not relevant:
            return

        owner = user_repository.get_user_by_id(device.owner_id, db)
        if owner is None:
            return
        recipients = _recipients(owner, row)
        if not recipients:
            return

        subject, body = _alert_message(device, relevant)
        dispatcher.submit(
            dispatcher.Delivery(
                subject=subject,
                body=body,
                email_to=recipients.get("email"),
                telegram_chat_id=recipients.get("telegram"),
            )
        )
    except Exception as exc:
        logger.warning("Alert notification skipped (%s)", type(exc).__name__)


def send_test(db: Session, current_user: User) -> NotificationTestResponse:
    """Queue a test message to the user's enabled channels (rate limited per user)."""
    recipients = _recipients(current_user, notification_repository.get_settings(current_user.id, db))
    if not recipients:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Enable and save at least one notification channel first",
        )

    now = time.monotonic()
    with _test_lock:
        last = _last_test_at.get(current_user.id)
        if last is not None and now - last < TEST_COOLDOWN_SECONDS:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"Wait {TEST_COOLDOWN_SECONDS} seconds between test notifications",
            )
        _last_test_at[current_user.id] = now

    lines = [
        f"Hello {current_user.full_name},",
        "",
        "This is a test notification from EdgeSphere. Alerts will be delivered here.",
    ]
    dispatcher.submit(
        dispatcher.Delivery(
            subject="[EdgeSphere] Test notification",
            body="\n".join(lines),
            email_to=recipients.get("email"),
            telegram_chat_id=recipients.get("telegram"),
        )
    )
    return NotificationTestResponse(queued_channels=sorted(recipients))
