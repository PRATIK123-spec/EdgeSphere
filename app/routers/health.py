from fastapi import APIRouter, Depends, status
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from app.database.dependencies import get_db
from app.services import health_service

router = APIRouter(tags=["Health"])


@router.get("/health")
def health():
    """Liveness: the process is up. Does not touch the database."""
    return {"status": "ok"}


@router.get("/ready")
def ready(db: Session = Depends(get_db)):
    """Readiness: the API can reach the database. 503 when it cannot."""
    if health_service.is_database_ready(db):
        return {"status": "ready"}
    return JSONResponse(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        content={"status": "unavailable"},
    )
