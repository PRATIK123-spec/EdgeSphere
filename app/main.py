from contextlib import asynccontextmanager
import asyncio

from fastapi import FastAPI

from app.core.config import settings
from app.models import Alert, Device, Telemetry, User
from app.routers.auth import router as auth_router
from app.routers.devices import router as device_router
from app.routers.users import router as users_router
from app.routers import alert
from app.routers import analytics
from app.routers import telemetry
from app.routers import websocket
from app.services import device_monitor

_ = (User, Device, Telemetry, Alert)


@asynccontextmanager
async def lifespan(app: FastAPI):
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


app = FastAPI(
    title="EdgeSphere API",
    version="1.0.0",
    description="Edge Device Management Platform",
    lifespan=lifespan,
)

app.include_router(auth_router)
app.include_router(users_router)
app.include_router(device_router)
app.include_router(telemetry.router)
app.include_router(analytics.router)
app.include_router(websocket.router)
app.include_router(alert.router)


@app.get("/")
def home():
    return {
        "message": "Welcome to EdgeSphere 🚀"
    }
