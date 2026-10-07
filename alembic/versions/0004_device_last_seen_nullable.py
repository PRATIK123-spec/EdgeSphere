"""devices.last_seen: NULL until the device first reports.

Previously last_seen defaulted to the registration time, so a device that
had never reported looked like it had. This revision:

- makes last_seen nullable;
- repairs existing rows from real telemetry:
    * devices with telemetry  -> last_seen = their newest reading's time
    * devices without any     -> last_seen = NULL, status = 'Offline'

Rows are updated, never deleted. devices.created_at keeps the registration time.

Revision ID: 0004_device_last_seen_nullable
Revises: 0003_schema_hardening
Create Date: 2026-10-06
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "0004_device_last_seen_nullable"
down_revision: Union[str, Sequence[str], None] = "0003_schema_hardening"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column("devices", "last_seen", existing_type=sa.DateTime(), nullable=True)

    op.execute(
        """
        UPDATE devices
        SET last_seen = latest.created_at
        FROM (
            SELECT device_id, max(created_at) AS created_at
            FROM telemetry
            GROUP BY device_id
        ) AS latest
        WHERE latest.device_id = devices.id
        """
    )
    op.execute(
        """
        UPDATE devices
        SET last_seen = NULL, status = 'Offline'
        WHERE NOT EXISTS (SELECT 1 FROM telemetry t WHERE t.device_id = devices.id)
        """
    )


def downgrade() -> None:
    op.execute("UPDATE devices SET last_seen = created_at WHERE last_seen IS NULL")
    op.alter_column("devices", "last_seen", existing_type=sa.DateTime(), nullable=False)
