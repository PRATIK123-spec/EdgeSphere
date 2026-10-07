from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy.orm import Session

from app.core.security import get_current_user
from app.database.dependencies import get_db
from app.models.user import User
from app.repositories.alert_repository import AlertFilters
from app.schemas.alert import AlertResponse, AlertStatus
from app.schemas.common import TOTAL_COUNT_HEADER
from app.services import alert_service
from app.utils.time import to_naive_utc, validate_range

router = APIRouter(
    prefix="/alerts",
    tags=["Alerts"]
)

DEFAULT_LIMIT = 100
MAX_LIMIT = 500
MAX_FILTER_VALUES = 10


class AlertQuery:
    """
    Shared filter/pagination query parameters. Repeat a parameter to match
    any of several values, e.g. ?status=active&status=acknowledged.
    """

    def __init__(
        self,
        severity: list[str] | None = Query(None, description="e.g. CRITICAL, HIGH"),
        alert_type: list[str] | None = Query(None, description="e.g. TEMPERATURE, BATTERY, CPU, RAM"),
        status: list[AlertStatus] | None = Query(None),
        since: datetime | None = Query(None),
        until: datetime | None = Query(None),
        limit: int = Query(DEFAULT_LIMIT, ge=1, le=MAX_LIMIT),
        offset: int = Query(0, ge=0),
    ):
        for values in (severity, alert_type):
            if values and (len(values) > MAX_FILTER_VALUES or any(len(v) > 50 for v in values)):
                raise HTTPException(
                    status_code=422,
                    detail=f"At most {MAX_FILTER_VALUES} values of up to 50 characters per filter",
                )
        self.severity = severity
        self.alert_type = alert_type
        self.status = status
        self.since = to_naive_utc(since)
        self.until = to_naive_utc(until)
        self.limit = limit
        self.offset = offset
        validate_range(self.since, self.until)

    def filters(self, owner_id: int, device_id: int | None = None) -> AlertFilters:
        return AlertFilters(
            owner_id=owner_id,
            device_id=device_id,
            severities=self.severity,
            alert_types=self.alert_type,
            statuses=list(self.status) if self.status else None,
            since=self.since,
            until=self.until,
        )


@router.get(
    "/",
    response_model=list[AlertResponse]
)
def list_fleet_alerts(
    response: Response,
    query: AlertQuery = Depends(),
    device_id: int | None = Query(None, description="Restrict to one of your devices"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Alerts across all of the current user's devices, newest first."""
    page = alert_service.list_alerts(
        query.filters(current_user.id, device_id),
        db,
        limit=query.limit,
        offset=query.offset,
    )
    response.headers[TOTAL_COUNT_HEADER] = str(page.total)
    return page.items


@router.post(
    "/check/{device_id}",
    response_model=list[AlertResponse]
)
def check_alerts(
    device_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return alert_service.check_device(
        device_id,
        db,
        current_user
    )


@router.post(
    "/{alert_id}/acknowledge",
    response_model=AlertResponse
)
def acknowledge_alert(
    alert_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return alert_service.acknowledge(alert_id, db, current_user)


@router.post(
    "/{alert_id}/resolve",
    response_model=AlertResponse
)
def resolve_alert(
    alert_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return alert_service.resolve(alert_id, db, current_user)


@router.get(
    "/{device_id}",
    response_model=list[AlertResponse]
)
def get_alerts(
    device_id: int,
    response: Response,
    query: AlertQuery = Depends(),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """One device's alerts, newest first (same filters as GET /alerts/)."""
    page = alert_service.get_alerts(
        device_id,
        db,
        current_user,
        query.filters(current_user.id),
        limit=query.limit,
        offset=query.offset,
    )
    response.headers[TOTAL_COUNT_HEADER] = str(page.total)
    return page.items


@router.delete("/{alert_id}")
def delete_alert(
    alert_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Alerts cannot be deleted (409); resolve them instead. 404 if not yours."""
    return alert_service.delete(
        alert_id,
        db,
        current_user
    )
