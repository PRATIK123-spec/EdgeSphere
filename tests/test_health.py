from sqlalchemy.exc import OperationalError

from app.database.dependencies import get_db
from app.main import app
from app.repositories import health_repository


def test_health_is_ok_without_database(client):
    def no_db():
        raise AssertionError("/health must not open a database session")
        yield  # pragma: no cover

    app.dependency_overrides[get_db] = no_db

    response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_ready_when_database_answers(client):
    response = client.get("/ready")

    assert response.status_code == 200
    assert response.json() == {"status": "ready"}


def test_ready_returns_503_without_internals(client, monkeypatch):
    def broken_ping(_db):
        raise OperationalError(
            "SELECT 1", {}, Exception("connection to secret-db.internal:5432 failed for user admin")
        )

    monkeypatch.setattr(health_repository, "ping", broken_ping)

    response = client.get("/ready")

    assert response.status_code == 503
    assert response.json() == {"status": "unavailable"}
    assert "secret-db" not in response.text
    assert "SELECT" not in response.text


def test_health_endpoints_need_no_auth(client):
    assert client.get("/health").status_code == 200
    assert client.get("/ready").status_code == 200
