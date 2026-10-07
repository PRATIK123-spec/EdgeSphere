from datetime import datetime, timezone

from fastapi import HTTPException, status


def utc_now() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def to_naive_utc(value: datetime | None) -> datetime | None:
    """
    The database stores naive UTC timestamps. Convert timezone-aware query
    parameters to naive UTC; naive values are taken to already be UTC.
    """
    if value is None or value.tzinfo is None:
        return value
    return value.astimezone(timezone.utc).replace(tzinfo=None)


def validate_range(since: datetime | None, until: datetime | None) -> None:
    if since is not None and until is not None and since > until:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="'since' must be earlier than 'until'",
        )
