from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base

if TYPE_CHECKING:
    from app.models.user import User
    from app.models.telemetry import Telemetry
    from app.models.alert import Alert


class Device(Base):
    __tablename__ = "devices"

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
    # Secret Device Authentication Key
    # Never exposed publicly
    # ----------------------------------
    device_key: Mapped[str] = mapped_column(
        String(128),
        unique=True,
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
        ForeignKey("users.id"),
        nullable=False,
        index=True
    )

    owner: Mapped["User"] = relationship(
        back_populates="devices"
    )

    # ----------------------------------
    # Last Telemetry Timestamp
    # Updated whenever telemetry arrives
    # ----------------------------------
    last_seen: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        nullable=False
    )

    # ----------------------------------
    # Device Registration Time
    # ----------------------------------
    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        nullable=False
    )

    # ----------------------------------
    # Relationships
    # ----------------------------------
    telemetry: Mapped[list["Telemetry"]] = relationship(
        back_populates="device",
        cascade="all, delete-orphan"
    )

    alerts: Mapped[list["Alert"]] = relationship(
        back_populates="device",
        cascade="all, delete-orphan"
    )
