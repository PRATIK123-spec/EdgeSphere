from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, Float, ForeignKey, Integer
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base

if TYPE_CHECKING:
    from app.models.device import Device


class Telemetry(Base):
    __tablename__ = "telemetry"

    id: Mapped[int] = mapped_column(
        primary_key=True
    )

    device_id: Mapped[int] = mapped_column(
        ForeignKey("devices.id"),
        nullable=False,
        index=True
    )

    temperature: Mapped[float] = mapped_column(
        Float,
        nullable=False
    )

    battery: Mapped[int] = mapped_column(
        Integer,
        nullable=False
    )

    cpu_usage: Mapped[float] = mapped_column(
        Float,
        nullable=False
    )

    ram_usage: Mapped[float] = mapped_column(
        Float,
        nullable=False
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        nullable=False
    )

    device: Mapped["Device"] = relationship(
        back_populates="telemetry"
    )