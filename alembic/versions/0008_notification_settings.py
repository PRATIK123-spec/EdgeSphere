"""Per-user alert notification settings.

notification_settings: one optional row per user (PK = FK to users, ON DELETE
CASCADE). No row means notifications are off, so existing users are unaffected.

Non-destructive: a table is added.

Revision ID: 0008_notification_settings
Revises: 0007_device_alert_thresholds
Create Date: 2026-11-05
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0008_notification_settings"
down_revision: str | Sequence[str] | None = "0007_device_alert_thresholds"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "notification_settings",
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("email_enabled", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("telegram_enabled", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("telegram_chat_id", sa.String(64), nullable=True),
        sa.Column("min_severity", sa.String(20), nullable=False, server_default="HIGH"),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("user_id"),
        sa.CheckConstraint("min_severity IN ('HIGH', 'CRITICAL')", name="ck_notification_settings_min_severity"),
    )


def downgrade() -> None:
    op.drop_table("notification_settings")
