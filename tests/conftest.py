from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from fastapi.testclient import TestClient
import pytest

from app.core.config import settings
from app.database.base import Base
from app.database.dependencies import get_db
from app.models import Alert, Device, Telemetry, User

settings.DEVICE_MONITOR_ENABLED = False

from app.main import app

_ = (User, Device, Telemetry, Alert)


TEST_DATABASE_URL = "sqlite+pysqlite:///:memory:"

engine = create_engine(
    TEST_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)

TestingSessionLocal = sessionmaker(
    bind=engine,
    autoflush=False,
    autocommit=False,
)


@pytest.fixture
def db_session():
    Base.metadata.create_all(bind=engine)
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(bind=engine)


@pytest.fixture
def client(db_session):
    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


def register_and_login(client: TestClient, email: str, password: str = "secret123"):
    register = client.post(
        "/auth/register",
        json={
            "email": email,
            "password": password,
            "full_name": "Test User",
        },
    )
    assert register.status_code == 201

    login = client.post(
        "/auth/login",
        data={
            "username": email,
            "password": password,
        },
    )
    assert login.status_code == 200
    token = login.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}
