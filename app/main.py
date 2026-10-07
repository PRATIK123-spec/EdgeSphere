from contextlib import asynccontextmanager
import asyncio
import logging

from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy.exc import IntegrityError, SQLAlchemyError

from app.core.config import settings
from app.models import Alert, Device, Telemetry, User
from app.realtime.hub import hub
from app.routers.auth import router as auth_router
from app.routers.devices import router as device_router
from app.routers.users import router as users_router
from app.routers import alert
from app.routers import analytics
from app.routers import dashboard
from app.routers import telemetry
from app.routers import websocket
from app.schemas.common import TOTAL_COUNT_HEADER
from app.services import device_monitor

_ = (User, Device, Telemetry, Alert)

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Real-time events are published from worker threads onto this loop.
    hub.bind_loop(asyncio.get_running_loop())

    stop = asyncio.Event()
    task = None

    if settings.DEVICE_MONITOR_ENABLED:
        task = asyncio.create_task(device_monitor.run_device_monitor(stop))

    try:
        yield
    finally:
        stop.set()
        if task is not None:
            task.cancel()
            try:
                await task
            except asyncio.CancelledError:
                pass
        hub.unbind_loop()


app = FastAPI(
    title="EdgeSphere API",
    version="1.0.0",
    description="Edge Device Management Platform",
    lifespan=lifespan,
)

# CORS is opt-in via CORS_ORIGINS (explicit origins, never "*"). Auth uses
# bearer tokens, not cookies, so credentials are not allowed cross-origin.
if settings.cors_origins:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=False,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
        allow_headers=["Authorization", "Content-Type"],
        expose_headers=[TOTAL_COUNT_HEADER],
        max_age=600,
    )


# Never leak SQL, stack traces or internals to clients; log server-side.
@app.exception_handler(IntegrityError)
async def integrity_error_handler(request: Request, exc: IntegrityError):
    logger.warning("Integrity error on %s %s", request.method, request.url.path)
    return JSONResponse(
        status_code=status.HTTP_409_CONFLICT,
        content={"detail": "The request conflicts with existing data"},
    )


@app.exception_handler(SQLAlchemyError)
async def database_error_handler(request: Request, exc: SQLAlchemyError):
    logger.exception("Database error on %s %s", request.method, request.url.path)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": "Internal server error"},
    )


@app.exception_handler(Exception)
async def unhandled_error_handler(request: Request, exc: Exception):
    logger.exception("Unhandled error on %s %s", request.method, request.url.path)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": "Internal server error"},
    )


app.include_router(auth_router)
app.include_router(users_router)
app.include_router(device_router)
app.include_router(telemetry.router)
app.include_router(analytics.router)
app.include_router(dashboard.router)
app.include_router(websocket.router)
app.include_router(alert.router)


@app.get("/")
def home():
    return {
        "message": "Welcome to EdgeSphere 🚀"
    }
