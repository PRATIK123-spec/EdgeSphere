"""Drop obsolete devices.name column.

The live devices table still has a leftover name VARCHAR(100) NOT NULL
column from an earlier schema. The ORM now uses display_name only.

This migration does not drop tables or delete rows. It only removes
the unused column when it is present.

Revision ID: 0001_drop_devices_name
Revises:
Create Date: 2026-10-05
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect


revision: str = "0001_drop_devices_name"
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)

    if "devices" not in inspector.get_table_names():
        return

    columns = {column["name"] for column in inspector.get_columns("devices")}
    if "name" not in columns:
        return

    op.drop_column("devices", "name")


def downgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)

    if "devices" not in inspector.get_table_names():
        return

    columns = {column["name"] for column in inspector.get_columns("devices")}
    if "name" in columns:
        return

    op.add_column(
        "devices",
        sa.Column("name", sa.String(length=100), nullable=True),
    )
