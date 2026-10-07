from datetime import datetime

from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy.orm import Session

from app.core.device_security import get_current_device
from app.core.security import get_current_user
from app.database.dependencies import get_db
from app.models.device import Device
from app.models.user import User
from app.schemas.common import TOTAL_COUNT_HEADER
from app.schemas.telemetry import (
    TelemetryCreate,
    TelemetryResponse,
    TelemetrySeriesResponse,
)
from app.services import telemetry_service
from app.utils.time import to_naive_utc

router = APIRouter(
    prefix="/telemetry",
    tags=["Telemetry"]
)

# History pages: default size keeps unparameterised requests (the old
# "return everything" call) bounded; the maximum can never be exceeded.
HISTORY_DEFAULT_LIMIT = 100
HISTORY_MAX_LIMIT = 1000
SERIES_DEFAULT_POINTS = 300
SERIES_MAX_POINTS = 1000


@router.post(
    "/",
    response_model=TelemetryResponse
)
def create_telemetry(
    telemetry: TelemetryCreate,
    current_device: Device = Depends(get_current_device),
    db: Session = Depends(get_db),
):
    # The device is identified solely by its key (never by request data).
    return telemetry_service.create_telemetry(
        current_device,
        telemetry,
        db
    )


@router.get(
    "/latest/{device_id}",
    response_model=TelemetryResponse | None
)
def get_latest(
    device_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return telemetry_service.get_latest(
        device_id,
        db,
        current_user
    )


@router.get(
    "/{device_id}/series",
    response_model=TelemetrySeriesResponse
)
def get_series(
    device_id: int,
    since: datetime | None = Query(None, description="Start of range (ISO 8601). Default: first reading."),
    until: datetime | None = Query(None, description="End of range (ISO 8601). Default: now."),
    max_points: int = Query(SERIES_DEFAULT_POINTS, ge=1, le=SERIES_MAX_POINTS),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Readings aggregated server-side into at most `max_points` time buckets."""
    return telemetry_service.get_series(
        device_id,
        db,
        current_user,
        since=to_naive_utc(since),
        until=to_naive_utc(until),
        max_points=max_points,
    )


@router.get(
    "/{device_id}",
    response_model=list[TelemetryResponse]
)
def get_history(
    device_id: int,
    response: Response,
    limit: int = Query(HISTORY_DEFAULT_LIMIT, ge=1, le=HISTORY_MAX_LIMIT),
    offset: int = Query(0, ge=0),
    since: datetime | None = Query(None),
    until: datetime | None = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    One page of readings, newest first. The total number of readings
    matching the filters is returned in the X-Total-Count header.
    """
    page = telemetry_service.get_history(
        device_id,
        db,
        current_user,
        limit=limit,
        offset=offset,
        since=to_naive_utc(since),
        until=to_naive_utc(until),
    )
    response.headers[TOTAL_COUNT_HEADER] = str(page.total)
    return page.items


@router.delete(
    "/{telemetry_id}"
)
def delete_telemetry(
    telemetry_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return telemetry_service.delete(
        telemetry_id,
        db,
        current_user
    )
