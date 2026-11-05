from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import CheckConstraint, DateTime, Float, ForeignKey, Index, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.alert_thresholds import effective_thresholds
from app.database.base import Base
from app.utils.device_identity import device_key_prefix, hash_device_key
from app.utils.time import utc_now

if TYPE_CHECKING:
    from app.models.alert import Alert
    from app.models.telemetry import Telemetry
    from app.models.user import User


class Device(Base):
    __tablename__ = "devices"
    __table_args__ = (
        Index("ix_devices_last_seen", "last_seen"),
        CheckConstraint(
            "alert_temperature_max IS NULL OR alert_temperature_max BETWEEN -100 AND 250",
            name="ck_devices_alert_temperature_max",
        ),
        CheckConstraint(
            "alert_battery_min IS NULL OR alert_battery_min BETWEEN 0 AND 100", name="ck_devices_alert_battery_min"
        ),
        CheckConstraint("alert_cpu_max IS NULL OR alert_cpu_max BETWEEN 0 AND 100", name="ck_devices_alert_cpu_max"),
        CheckConstraint("alert_ram_max IS NULL OR alert_ram_max BETWEEN 0 AND 100", name="ck_devices_alert_ram_max"),
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
    # Per-device alert thresholds
    # NULL = use the default (app/core/alert_thresholds.py).
    # ----------------------------------
    alert_temperature_max: Mapped[float | None] = mapped_column(Float, nullable=True)

    alert_battery_min: Mapped[float | None] = mapped_column(Float, nullable=True)

    alert_cpu_max: Mapped[float | None] = mapped_column(Float, nullable=True)

    alert_ram_max: Mapped[float | None] = mapped_column(Float, nullable=True)

    @property
    def alert_thresholds(self) -> dict[str, float]:
        """Effective thresholds (overrides merged with defaults)."""
        return effective_thresholds(self).as_dict()

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
