from fastapi import FastAPI

from app.database.base import Base
from app.models.user import User
from app.database.connection import engine
from app.routers.auth import router as auth_router

# Import models so SQLAlchemy knows about them
from app.models.device import Device

from app.routers.devices import router as device_router
from app.routers.users import router as users_router
from app.routers import telemetry
from app.routers import analytics
from app.routers import websocket
from app.routers import alert
# Create all database tables
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="EdgeSphere API",
    version="1.0.0",
    description="Edge Device Management Platform"
)

# Register routers

app.include_router(users_router)
app.include_router(device_router)
app.include_router(auth_router)
app.include_router(
    telemetry.router
)
app.include_router(analytics.router)

app.include_router(websocket.router)
app.include_router(alert.router)


@app.get("/")
def home():
    return {
        "message": "Welcome to EdgeSphere 🚀"
    }