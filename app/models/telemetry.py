from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Index, Integer, false
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base
from app.utils.time import utc_now

if TYPE_CHECKING:
    from app.models.device import Device


class Telemetry(Base):
    __tablename__ = "telemetry"
    __table_args__ = (
        # History, latest-reading, range and aggregation queries all filter
        # by device and order/range by time.
        Index("ix_telemetry_device_id_created_at", "device_id", "created_at"),
    )

    id: Mapped[int] = mapped_column(
        primary_key=True
    )

    device_id: Mapped[int] = mapped_column(
        ForeignKey("devices.id", ondelete="CASCADE"),
        nullable=False
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
        default=utc_now,
        nullable=False
    )

    # True once alert rules have been evaluated for this reading, so
    # evaluation is idempotent (re-checks never re-alert the same reading).
    alerts_evaluated: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        server_default=false(),
        nullable=False
    )

    device: Mapped["Device"] = relationship(
        back_populates="telemetry"
    )
