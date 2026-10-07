"""Create the base tables for new databases.

Existing databases already have these tables; for them this revision is a
no-op (each table is only created when missing). The DDL below is the
schema as it stood at this revision, written out explicitly so migrations
never depend on the current ORM models (Base.metadata.create_all).
It also drops a leftover devices.name column if present.

Revision ID: 0002_create_missing_tables
Revises: 0001_drop_devices_name
Create Date: 2026-10-05
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect


revision: str = "0002_create_missing_tables"
down_revision: Union[str, Sequence[str], None] = "0001_drop_devices_name"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    existing = set(inspect(bind).get_table_names())

    if "users" not in existing:
        op.create_table(
            "users",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("email", sa.String(255), nullable=False, unique=True),
            sa.Column("hashed_password", sa.String(255), nullable=False),
            sa.Column("full_name", sa.String(100), nullable=False),
            sa.Column("is_active", sa.Boolean(), nullable=False),
            sa.Column("is_admin", sa.Boolean(), nullable=False),
            sa.Column("created_at", sa.DateTime(), nullable=False),
        )

    if "devices" not in existing:
        op.create_table(
            "devices",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("display_name", sa.String(100), nullable=False),
            sa.Column("device_type", sa.String(50), nullable=False),
            sa.Column("manufacturer", sa.String(50), nullable=False),
            sa.Column("model", sa.String(50), nullable=False),
            sa.Column("serial_number", sa.String(100), nullable=False, unique=True),
            sa.Column("device_key", sa.String(128), nullable=False, unique=True),
            sa.Column("firmware_version", sa.String(20), nullable=False),
            sa.Column("status", sa.String(30), nullable=False),
            sa.Column("owner_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
            sa.Column("last_seen", sa.DateTime(), nullable=False),
            sa.Column("created_at", sa.DateTime(), nullable=False),
        )
        op.create_index("ix_devices_owner_id", "devices", ["owner_id"])

    if "telemetry" not in existing:
        op.create_table(
            "telemetry",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("device_id", sa.Integer(), sa.ForeignKey("devices.id"), nullable=False),
            sa.Column("temperature", sa.Float(), nullable=False),
            sa.Column("battery", sa.Integer(), nullable=False),
            sa.Column("cpu_usage", sa.Float(), nullable=False),
            sa.Column("ram_usage", sa.Float(), nullable=False),
            sa.Column("created_at", sa.DateTime(), nullable=False),
        )
        op.create_index("ix_telemetry_device_id", "telemetry", ["device_id"])

    if "alerts" not in existing:
        op.create_table(
            "alerts",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("device_id", sa.Integer(), sa.ForeignKey("devices.id"), nullable=False),
            sa.Column("alert_type", sa.String(50), nullable=False),
            sa.Column("message", sa.String(255), nullable=False),
            sa.Column("severity", sa.String(20), nullable=False),
            sa.Column("created_at", sa.DateTime(), nullable=False),
        )

    if "devices" in existing:
        columns = {column["name"] for column in inspect(bind).get_columns("devices")}
        if "name" in columns:
            op.drop_column("devices", "name")


def downgrade() -> None:
    # Never drop tables (and their data) on downgrade.
    pass
