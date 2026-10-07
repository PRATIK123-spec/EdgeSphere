"""Schema hardening: database-level cascades, query indexes, NOT NULLs.

- Foreign keys get ON DELETE CASCADE so deleting a user/device no longer
  requires the ORM to load every child row (the ORM now uses passive_deletes).
- Composite indexes for the hot queries:
    telemetry(device_id, created_at)   history / latest / ranges / series
    devices(last_seen)                 offline monitor
  ix_telemetry_device_id becomes redundant (leading column of the composite).
- Case-insensitive unique index on lower(users.email).

Non-destructive: no rows are deleted or rewritten.

Revision ID: 0003_schema_hardening
Revises: 0002_create_missing_tables
Create Date: 2026-10-06
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect


revision: str = "0003_schema_hardening"
down_revision: Union[str, Sequence[str], None] = "0002_create_missing_tables"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# (table, column, referred table, new FK name)
_FKS = (
    ("devices", "owner_id", "users", "fk_devices_owner_id_users"),
    ("telemetry", "device_id", "devices", "fk_telemetry_device_id_devices"),
    ("alerts", "device_id", "devices", "fk_alerts_device_id_devices"),
)


def _fk_name(bind, table: str, column: str) -> str | None:
    for fk in inspect(bind).get_foreign_keys(table):
        if fk["constrained_columns"] == [column]:
            return fk["name"]
    return None


def _index_names(bind, table: str) -> set[str]:
    return {ix["name"] for ix in inspect(bind).get_indexes(table)}


def upgrade() -> None:
    bind = op.get_bind()

    duplicates = bind.execute(
        sa.text("SELECT count(*) FROM (SELECT lower(email) FROM users GROUP BY lower(email) HAVING count(*) > 1) d")
    ).scalar()
    if duplicates:
        raise RuntimeError(
            "users.email has addresses that differ only by case; resolve them before "
            "running this migration (no data was changed)."
        )

    for table, column, referred, new_name in _FKS:
        old_name = _fk_name(bind, table, column)
        if old_name:
            op.drop_constraint(old_name, table, type_="foreignkey")
        op.create_foreign_key(new_name, table, referred, [column], ["id"], ondelete="CASCADE")

    if "ix_telemetry_device_id_created_at" not in _index_names(bind, "telemetry"):
        op.create_index("ix_telemetry_device_id_created_at", "telemetry", ["device_id", "created_at"])
    if "ix_telemetry_device_id" in _index_names(bind, "telemetry"):
        op.drop_index("ix_telemetry_device_id", table_name="telemetry")

    if "ix_devices_last_seen" not in _index_names(bind, "devices"):
        op.create_index("ix_devices_last_seen", "devices", ["last_seen"])
    if "ix_devices_owner_id" not in _index_names(bind, "devices"):
        op.create_index("ix_devices_owner_id", "devices", ["owner_id"])

    if "uq_users_email_lower" not in _index_names(bind, "users"):
        op.create_index("uq_users_email_lower", "users", [sa.text("lower(email)")], unique=True)


def downgrade() -> None:
    bind = op.get_bind()

    op.drop_index("uq_users_email_lower", table_name="users")
    op.drop_index("ix_devices_last_seen", table_name="devices")
    op.create_index("ix_telemetry_device_id", "telemetry", ["device_id"])
    op.drop_index("ix_telemetry_device_id_created_at", table_name="telemetry")

    for table, column, referred, new_name in _FKS:
        if _fk_name(bind, table, column) == new_name:
            op.drop_constraint(new_name, table, type_="foreignkey")
        op.create_foreign_key(None, table, referred, [column], ["id"])
