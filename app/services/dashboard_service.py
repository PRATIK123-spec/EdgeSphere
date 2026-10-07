from datetime import timedelta

from sqlalchemy.orm import Session

from app.models.user import User
from app.repositories import dashboard_repository
from app.schemas.dashboard import (
    AlertCounts,
    DashboardSummary,
    DeviceCounts,
    HourlyActivity,
    TelemetryActivity,
)
from app.utils.time import utc_now

HOURS = 24


def get_summary(db: Session, current_user: User) -> DashboardSummary:
    """
    Fleet overview for the current user, computed with a handful of
    aggregate SQL queries (no row downloads).
    """
    now = utc_now()
    owner_id = current_user.id

    total, online, never_seen = dashboard_repository.device_counts(owner_id, db)

    critical = high = active_total = acknowledged = 0
    for severity, alert_status, count in dashboard_repository.open_alert_counts(owner_id, db):
        active_total += count
        if alert_status == "acknowledged":
            acknowledged += count
        if severity == "CRITICAL":
            critical += count
        elif severity == "HIGH":
            high += count

    recent_alert_devices = dashboard_repository.devices_with_alerts_since(owner_id, now - timedelta(hours=24), db)

    # 24 hourly buckets ending with the current (partial) hour.
    current_hour = now.replace(minute=0, second=0, microsecond=0)
    first_hour = current_hour - timedelta(hours=HOURS - 1)
    hourly_rows, last_reading_at = dashboard_repository.telemetry_activity(owner_id, first_hour, first_hour, db)
    by_bucket = {int(bucket): count for bucket, count in hourly_rows}
    hourly = [
        HourlyActivity(hour_start=first_hour + timedelta(hours=i), readings=by_bucket.get(i, 0))
        for i in range(HOURS)
    ]

    readings_last_hour_cutoff = now - timedelta(hours=1)
    # The last hour spans the current bucket and part of the previous one;
    # compute it exactly with a dedicated count rather than approximating.
    readings_last_hour = dashboard_repository.readings_since(owner_id, readings_last_hour_cutoff, db)
    readings_last_24h = dashboard_repository.readings_since(owner_id, now - timedelta(hours=24), db)

    return DashboardSummary(
        generated_at=now,
        devices=DeviceCounts(
            total=total,
            online=online,
            offline=total - online,
            never_seen=never_seen,
        ),
        alerts=AlertCounts(
            active_critical=critical,
            active_high=high,
            active_total=active_total,
            acknowledged=acknowledged,
            devices_with_recent_alerts=recent_alert_devices,
        ),
        telemetry=TelemetryActivity(
            readings_last_hour=readings_last_hour,
            readings_last_24h=readings_last_24h,
            last_reading_at=last_reading_at,
            hourly=hourly,
        ),
    )
