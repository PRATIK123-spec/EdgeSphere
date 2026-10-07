"""Store device keys as SHA-256 hashes instead of plaintext.

- Adds devices.key_hash (unique; used for lookup) and devices.key_prefix
  (non-secret display identifier, e.g. 'edg_1a2b3c4d').
- Hashes every existing plaintext key in place, so physical devices keep
  working with the key they already have.
- Drops the plaintext devices.device_key column.

IRREVERSIBLE BY DESIGN: plaintext keys cannot be recovered from hashes.
downgrade() restores the column shape only; affected devices would need
their keys rotated. Back up the database before upgrading.

Revision ID: 0005_hash_device_keys
Revises: 0004_device_last_seen_nullable
Create Date: 2026-10-06
"""

import hashlib
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "0005_hash_device_keys"
down_revision: Union[str, Sequence[str], None] = "0004_device_last_seen_nullable"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_PREFIX = "edg_"
_DISPLAY_CHARS = 8


def _prefix(raw: str) -> str:
    body = raw[len(_PREFIX):] if raw.startswith(_PREFIX) else raw
    return f"{_PREFIX}{body[:_DISPLAY_CHARS]}"


def upgrade() -> None:
    op.add_column("devices", sa.Column("key_hash", sa.String(64), nullable=True))
    op.add_column("devices", sa.Column("key_prefix", sa.String(16), nullable=True))

    bind = op.get_bind()
    rows = bind.execute(sa.text("SELECT id, device_key FROM devices")).all()
    for device_id, raw_key in rows:
        bind.execute(
            sa.text("UPDATE devices SET key_hash = :h, key_prefix = :p WHERE id = :id"),
            {"h": hashlib.sha256(raw_key.encode("utf-8")).hexdigest(), "p": _prefix(raw_key), "id": device_id},
        )

    op.alter_column("devices", "key_hash", existing_type=sa.String(64), nullable=False)
    op.alter_column("devices", "key_prefix", existing_type=sa.String(16), nullable=False)
    op.create_unique_constraint("uq_devices_key_hash", "devices", ["key_hash"])
    op.drop_column("devices", "device_key")


def downgrade() -> None:
    # Plaintext keys cannot be restored. Recreate the column shape with a
    # placeholder that can never authenticate; rotate keys afterwards.
    op.add_column("devices", sa.Column("device_key", sa.String(128), nullable=True))
    op.execute("UPDATE devices SET device_key = 'revoked-' || key_hash")
    op.alter_column("devices", "device_key", existing_type=sa.String(128), nullable=False)
    op.create_unique_constraint("devices_device_key_key", "devices", ["device_key"])
    op.drop_constraint("uq_devices_key_hash", "devices", type_="unique")
    op.drop_column("devices", "key_prefix")
    op.drop_column("devices", "key_hash")
