from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Index, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base
from app.utils.time import utc_now

if TYPE_CHECKING:
    from app.models.device import Device

ALERT_STATUSES = ("active", "acknowledged", "resolved")


class Alert(Base):
    __tablename__ = "alerts"
    __table_args__ = (
        # A reading can raise each alert type at most once (DB-enforced
        # idempotency, safe under concurrent evaluation). NULL telemetry_id
        # (legacy rows, or the reading was later deleted) is not constrained.
        UniqueConstraint("telemetry_id", "alert_type", name="uq_alerts_telemetry_type"),
        CheckConstraint(
            "status IN ('active', 'acknowledged', 'resolved')",
            name="ck_alerts_status",
        ),
        Index("ix_alerts_device_id_created_at", "device_id", "created_at"),
        Index("ix_alerts_device_id_severity", "device_id", "severity"),
        Index("ix_alerts_device_id_status", "device_id", "status"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)

    device_id: Mapped[int] = mapped_column(
        ForeignKey("devices.id", ondelete="CASCADE"),
        nullable=False
    )

    # The reading that raised the alert (NULL for legacy alerts).
    telemetry_id: Mapped[int | None] = mapped_column(
        ForeignKey("telemetry.id", ondelete="SET NULL"),
        nullable=True,
        index=True
    )

    alert_type: Mapped[str] = mapped_column(
        String(50),
        nullable=False
    )

    message: Mapped[str] = mapped_column(
        String(255),
        nullable=False
    )

    severity: Mapped[str] = mapped_column(
        String(20),
        nullable=False
    )

    # Lifecycle: active -> acknowledged -> resolved (or active -> resolved).
    status: Mapped[str] = mapped_column(
        String(20),
        default="active",
        server_default="active",
        nullable=False
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=utc_now,
        nullable=False
    )

    acknowledged_at: Mapped[datetime | None] = mapped_column(
        DateTime,
        nullable=True
    )

    resolved_at: Mapped[datetime | None] = mapped_column(
        DateTime,
        nullable=True
    )

    device: Mapped["Device"] = relationship(
        back_populates="alerts"
    )
