import logging

from sqlalchemy.orm import Session

from app.repositories import health_repository

logger = logging.getLogger(__name__)


def is_database_ready(db: Session) -> bool:
    """True when the database answers a trivial query. Never raises."""
    try:
        health_repository.ping(db)
        return True
    except Exception as exc:
        # Log the error type only: driver messages can contain hosts or credentials.
        logger.warning("Readiness check failed: database unreachable (%s)", type(exc).__name__)
        return False
