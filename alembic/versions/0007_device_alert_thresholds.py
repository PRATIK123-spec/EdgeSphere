"""Per-device alert thresholds.

devices: four nullable FLOAT columns. NULL = the device uses the default
threshold (70 °C, 20 %, 90 %, 90 %), so existing devices keep their current
behaviour. CHECK constraints keep values inside the telemetry ranges.

Non-destructive: columns are added; no rows are changed.

Revision ID: 0007_device_alert_thresholds
Revises: 0006_alert_lifecycle
Create Date: 2026-11-05
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0007_device_alert_thresholds"
down_revision: str | Sequence[str] | None = "0006_alert_lifecycle"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

# (column, lower bound, upper bound)
COLUMNS = (
    ("alert_temperature_max", -100, 250),
    ("alert_battery_min", 0, 100),
    ("alert_cpu_max", 0, 100),
    ("alert_ram_max", 0, 100),
)


def upgrade() -> None:
    for column, low, high in COLUMNS:
        op.add_column("devices", sa.Column(column, sa.Float(), nullable=True))
        op.create_check_constraint(
            f"ck_devices_{column}", "devices", f"{column} IS NULL OR {column} BETWEEN {low} AND {high}"
        )


def downgrade() -> None:
    for column, _low, _high in reversed(COLUMNS):
        op.drop_constraint(f"ck_devices_{column}", "devices", type_="check")
        op.drop_column("devices", column)
