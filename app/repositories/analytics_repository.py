from sqlalchemy import select, func
from sqlalchemy.orm import Session

from app.models.telemetry import Telemetry


def get_device_analytics(
    device_id: int,
    db: Session
):
    statement = (
        select(
            func.count(Telemetry.id),
            func.avg(Telemetry.temperature),
            func.max(Telemetry.temperature),
            func.min(Telemetry.temperature),
            func.avg(Telemetry.battery),
            func.avg(Telemetry.cpu_usage),
            func.avg(Telemetry.ram_usage),
            func.max(Telemetry.created_at),
        )
        .where(Telemetry.device_id == device_id)
    )

    result = db.execute(statement)

    return result.one()