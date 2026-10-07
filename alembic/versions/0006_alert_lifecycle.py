"""Alert lifecycle and idempotent evaluation.

alerts:
- status ('active' | 'acknowledged' | 'resolved', CHECK constraint),
  acknowledged_at, resolved_at. Existing alerts become 'active'.
- telemetry_id: the reading that raised the alert (FK, ON DELETE SET NULL);
  UNIQUE (telemetry_id, alert_type) so a reading can never raise the same
  alert type twice, even under concurrent evaluation.
- indexes on (device_id, created_at), (device_id, severity), (device_id, status).

telemetry:
- alerts_evaluated flag. Existing readings are marked evaluated (they were
  evaluated at ingest, or predate alerting) so re-checks never retroactively
  raise alerts for historical readings.

Non-destructive: columns are added; no rows are deleted.

Revision ID: 0006_alert_lifecycle
Revises: 0005_hash_device_keys
Create Date: 2026-10-06
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "0006_alert_lifecycle"
down_revision: Union[str, Sequence[str], None] = "0005_hash_device_keys"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "alerts",
        sa.Column("status", sa.String(20), nullable=False, server_default="active"),
    )
    op.add_column("alerts", sa.Column("acknowledged_at", sa.DateTime(), nullable=True))
    op.add_column("alerts", sa.Column("resolved_at", sa.DateTime(), nullable=True))
    op.add_column("alerts", sa.Column("telemetry_id", sa.Integer(), nullable=True))

    op.create_foreign_key(
        "fk_alerts_telemetry_id_telemetry", "alerts", "telemetry",
        ["telemetry_id"], ["id"], ondelete="SET NULL",
    )
    op.create_check_constraint(
        "ck_alerts_status", "alerts", "status IN ('active', 'acknowledged', 'resolved')"
    )
    op.create_unique_constraint("uq_alerts_telemetry_type", "alerts", ["telemetry_id", "alert_type"])

    op.create_index("ix_alerts_telemetry_id", "alerts", ["telemetry_id"])
    op.create_index("ix_alerts_device_id_created_at", "alerts", ["device_id", "created_at"])
    op.create_index("ix_alerts_device_id_severity", "alerts", ["device_id", "severity"])
    op.create_index("ix_alerts_device_id_status", "alerts", ["device_id", "status"])

    op.add_column(
        "telemetry",
        sa.Column("alerts_evaluated", sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.execute("UPDATE telemetry SET alerts_evaluated = TRUE")


def downgrade() -> None:
    op.drop_column("telemetry", "alerts_evaluated")

    op.drop_index("ix_alerts_device_id_status", table_name="alerts")
    op.drop_index("ix_alerts_device_id_severity", table_name="alerts")
    op.drop_index("ix_alerts_device_id_created_at", table_name="alerts")
    op.drop_index("ix_alerts_telemetry_id", table_name="alerts")
    op.drop_constraint("uq_alerts_telemetry_type", "alerts", type_="unique")
    op.drop_constraint("ck_alerts_status", "alerts", type_="check")
    op.drop_constraint("fk_alerts_telemetry_id_telemetry", "alerts", type_="foreignkey")
    op.drop_column("alerts", "telemetry_id")
    op.drop_column("alerts", "resolved_at")
    op.drop_column("alerts", "acknowledged_at")
    op.drop_column("alerts", "status")
