from datetime import datetime, timedelta

from app.models.telemetry import Telemetry
from tests.conftest import register_and_login
from tests.helpers import ingest, user_with_device

BASE = datetime(2026, 1, 1, 12, 0, 0)


def _seed(db_session, device_id, count, *, step_seconds=60, start=BASE):
    db_session.add_all(
        Telemetry(
            device_id=device_id,
            temperature=20 + i,
            battery=100 - (i % 100),
            cpu_usage=float(i % 100),
            ram_usage=50.0,
            created_at=start + timedelta(seconds=i * step_seconds),
            alerts_evaluated=True,
        )
        for i in range(count)
    )
    db_session.commit()


def test_default_limit_bounds_unparameterised_requests(client, db_session):
    headers, device_id, _ = user_with_device(client, "p1@example.com")
    _seed(db_session, device_id, 250)

    response = client.get(f"/telemetry/{device_id}", headers=headers)
    assert response.status_code == 200
    assert len(response.json()) == 100
    assert response.headers["X-Total-Count"] == "250"


def test_limit_offset_pages_newest_first(client, db_session):
    headers, device_id, _ = user_with_device(client, "p2@example.com")
    _seed(db_session, device_id, 30)

    first = client.get(f"/telemetry/{device_id}?limit=10&offset=0", headers=headers).json()
    second = client.get(f"/telemetry/{device_id}?limit=10&offset=10", headers=headers).json()
    last = client.get(f"/telemetry/{device_id}?limit=10&offset=25", headers=headers).json()
    beyond = client.get(f"/telemetry/{device_id}?limit=10&offset=500", headers=headers)

    times = [r["created_at"] for r in first + second]
    assert times == sorted(times, reverse=True)
    assert {r["id"] for r in first}.isdisjoint({r["id"] for r in second})
    assert len(last) == 5
    assert beyond.json() == [] and beyond.headers["X-Total-Count"] == "30"


def test_max_limit_enforced_and_invalid_params_rejected(client, db_session):
    headers, device_id, _ = user_with_device(client, "p3@example.com")
    _seed(db_session, device_id, 5)
    assert client.get(f"/telemetry/{device_id}?limit=1000", headers=headers).status_code == 200
    for query in ("limit=1001", "limit=0", "limit=-5", "offset=-1", "limit=abc", "since=not-a-date", "until=2026-13-45"):
        assert client.get(f"/telemetry/{device_id}?{query}", headers=headers).status_code == 422, query


def test_since_until_range_filtering(client, db_session):
    headers, device_id, _ = user_with_device(client, "p4@example.com")
    _seed(db_session, device_id, 60)  # one reading per minute from 12:00 to 12:59

    response = client.get(
        f"/telemetry/{device_id}?since=2026-01-01T12:10:00&until=2026-01-01T12:19:00&limit=1000", headers=headers
    )
    rows = response.json()
    assert response.headers["X-Total-Count"] == "10"
    assert len(rows) == 10
    assert all("2026-01-01T12:10:00" <= r["created_at"] <= "2026-01-01T12:19:00" for r in rows)

    # Timezone-aware parameters are converted to UTC (12:10+02:00 == 10:10Z).
    aware = client.get(f"/telemetry/{device_id}?until=2026-01-01T14:05:00%2B02:00", headers=headers)
    assert aware.headers["X-Total-Count"] == "6"

    inverted = client.get(f"/telemetry/{device_id}?since=2026-01-01T13:00:00&until=2026-01-01T12:00:00", headers=headers)
    assert inverted.status_code == 422


def test_empty_results(client):
    headers, device_id, _ = user_with_device(client, "p5@example.com")
    response = client.get(f"/telemetry/{device_id}", headers=headers)
    assert response.json() == [] and response.headers["X-Total-Count"] == "0"
    assert client.get(f"/telemetry/latest/{device_id}", headers=headers).json() is None


def test_history_ownership(client, db_session):
    _, device_id, _ = user_with_device(client, "p6@example.com")
    other = register_and_login(client, "p6-other@example.com")
    assert client.get(f"/telemetry/{device_id}", headers=other).status_code == 404
    assert client.get(f"/telemetry/{device_id}/series", headers=other).status_code == 404
    assert client.get(f"/telemetry/{device_id}").status_code == 401


def test_ingest_rejects_impossible_values(client):
    _, _, key = user_with_device(client, "p7@example.com")
    for bad in ({"battery": 101}, {"battery": -1}, {"cpu_usage": 100.5}, {"ram_usage": -0.1}, {"temperature": 900}):
        response = client.post(
            "/telemetry/",
            json={"temperature": 30, "battery": 50, "cpu_usage": 10, "ram_usage": 10, **bad},
            headers={"X-DEVICE-KEY": key},
        )
        assert response.status_code == 422, bad
    ingest(client, key, battery=0, cpu_usage=100.0)  # boundaries accepted
