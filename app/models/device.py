from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, Index, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base
from app.utils.time import utc_now
from app.utils.device_identity import device_key_prefix, hash_device_key

if TYPE_CHECKING:
    from app.models.user import User
    from app.models.telemetry import Telemetry
    from app.models.alert import Alert


class Device(Base):
    __tablename__ = "devices"
    __table_args__ = (
        Index("ix_devices_last_seen", "last_seen"),
    )

    # ----------------------------------
    # Primary Key
    # ----------------------------------
    id: Mapped[int] = mapped_column(
        primary_key=True
    )

    # ----------------------------------
    # User Friendly Display Name
    # Example:
    # Living Room Light
    # Office Camera
    # Rack Server 2
    # ----------------------------------
    display_name: Mapped[str] = mapped_column(
        String(100),
        nullable=False
    )

    # ----------------------------------
    # Device Type
    # Smart Bulb
    # Camera
    # ESP32
    # Raspberry Pi
    # Laptop
    # ----------------------------------
    device_type: Mapped[str] = mapped_column(
        String(50),
        nullable=False
    )

    # ----------------------------------
    # Manufacturer
    # Philips
    # Dell
    # HP
    # Texas Instruments
    # ----------------------------------
    manufacturer: Mapped[str] = mapped_column(
        String(50),
        nullable=False
    )

    # ----------------------------------
    # Hardware Model
    # Hue A19
    # Latitude 5510
    # ESP32-WROOM
    # Raspberry Pi 5
    # ----------------------------------
    model: Mapped[str] = mapped_column(
        String(50),
        nullable=False
    )

    # ----------------------------------
    # Unique Hardware Serial Number
    # Generated automatically
    # ----------------------------------
    serial_number: Mapped[str] = mapped_column(
        String(100),
        unique=True,
        nullable=False
    )

    # ----------------------------------
    # Device Authentication Key
    # Only a SHA-256 hash of the key is stored (unique, used for lookup),
    # plus a short non-secret prefix so owners can tell keys apart.
    # The raw key is returned once at provisioning/rotation and never again.
    # ----------------------------------
    key_hash: Mapped[str] = mapped_column(
        String(64),
        unique=True,
        nullable=False
    )

    key_prefix: Mapped[str] = mapped_column(
        String(16),
        nullable=False
    )

    # ----------------------------------
    # Firmware Version
    # ----------------------------------
    firmware_version: Mapped[str] = mapped_column(
        String(20),
        default="1.0.0",
        nullable=False
    )

    # ----------------------------------
    # Device Status
    # Online
    # Offline
    # Maintenance
    # ----------------------------------
    status: Mapped[str] = mapped_column(
        String(30),
        default="Offline",
        nullable=False
    )

    # ----------------------------------
    # Device Owner
    # ----------------------------------
    owner_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )

    owner: Mapped["User"] = relationship(
        back_populates="devices"
    )

    # ----------------------------------
    # Last Telemetry Timestamp
    # NULL until the device reports for the first time.
    # Updated whenever telemetry arrives.
    # ----------------------------------
    last_seen: Mapped[datetime | None] = mapped_column(
        DateTime,
        nullable=True
    )

    # ----------------------------------
    # Device Registration Time
    # ----------------------------------
    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=utc_now,
        nullable=False
    )

    # ----------------------------------
    # Relationships
    # Deletes cascade in the database (ON DELETE CASCADE); passive_deletes
    # stops the ORM from loading every child row just to delete it.
    # ----------------------------------
    telemetry: Mapped[list["Telemetry"]] = relationship(
        back_populates="device",
        cascade="all, delete-orphan",
        passive_deletes=True
    )

    alerts: Mapped[list["Alert"]] = relationship(
        back_populates="device",
        cascade="all, delete-orphan",
        passive_deletes=True
    )

    # ----------------------------------
    # Write-only raw key setter
    # `device.device_key = raw` stores the hash and prefix. There is no
    # getter: a stored device can never yield its raw key.
    # ----------------------------------
    def _set_device_key(self, raw_key: str) -> None:
        self.key_hash = hash_device_key(raw_key)
        self.key_prefix = device_key_prefix(raw_key)

    device_key = property(fset=_set_device_key)
