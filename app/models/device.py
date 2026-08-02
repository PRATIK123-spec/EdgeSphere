from __future__ import annotations

from typing import TYPE_CHECKING

from sqlalchemy import ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base
from app.models.alert import Alert

if TYPE_CHECKING:
    from app.models.user import User
    from app.models.telemetry import Telemetry


class Device(Base):
    __tablename__ = "devices"

    id: Mapped[int] = mapped_column(
        primary_key=True
    )

    name: Mapped[str] = mapped_column(
        String(100),
        nullable=False
    )

    status: Mapped[str] = mapped_column(
        String(30),
        default="Offline"
    )

    owner_id: Mapped[int] = mapped_column(
        ForeignKey("users.id"),
        nullable=False,
        index=True
    )

    owner: Mapped["User"] = relationship(
        back_populates="devices"
    )

    telemetry: Mapped[list["Telemetry"]] = relationship(
        back_populates="device",
        cascade="all, delete-orphan"
    )