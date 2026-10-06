"""Create missing tables for new databases.

Existing databases already have tables. This revision uses
create_all(checkfirst=True), which adds missing tables without
dropping data. It also drops leftover devices.name if present.

Revision ID: 0002_create_missing_tables
Revises: 0001_drop_devices_name
Create Date: 2026-10-05
"""

from typing import Sequence, Union

from alembic import op
from sqlalchemy import inspect

from app.database.base import Base
from app.models import Alert, Device, Telemetry, User


revision: str = "0002_create_missing_tables"
down_revision: Union[str, Sequence[str], None] = "0001_drop_devices_name"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_ = (User, Device, Telemetry, Alert)


def upgrade() -> None:
    bind = op.get_bind()
    Base.metadata.create_all(bind=bind)

    inspector = inspect(bind)
    if "devices" not in inspector.get_table_names():
        return

    columns = {column["name"] for column in inspector.get_columns("devices")}
    if "name" in columns:
        op.drop_column("devices", "name")


def downgrade() -> None:
    pass
