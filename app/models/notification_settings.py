from __future__ import annotations

from datetime import datetime

from sqlalchemy import Boolean, CheckConstraint, DateTime, ForeignKey, String, false
from sqlalchemy.orm import Mapped, mapped_column

from app.database.base import Base
from app.utils.time import utc_now

SEVERITIES = ("HIGH", "CRITICAL")


class NotificationSettings(Base):
    """Per-user alert notification preferences. No row = everything off."""

    __tablename__ = "notification_settings"
    __table_args__ = (
        CheckConstraint("min_severity IN ('HIGH', 'CRITICAL')", name="ck_notification_settings_min_severity"),
    )

    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        primary_key=True,
    )

    # Email always goes to the account's own address.
    email_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default=false())

    telegram_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default=false())

    telegram_chat_id: Mapped[str | None] = mapped_column(String(64), nullable=True)

    # Lowest severity that triggers a notification: HIGH (HIGH + CRITICAL) or CRITICAL only.
    min_severity: Mapped[str] = mapped_column(String(20), nullable=False, default="HIGH", server_default="HIGH")

    updated_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=utc_now, onupdate=utc_now)
