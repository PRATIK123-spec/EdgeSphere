from datetime import timedelta

import pytest
from sqlalchemy.exc import IntegrityError

from app.core.config import settings
from app.models.alert import Alert
from app.models.telemetry import Telemetry
from app.utils.time import utc_now
from tests.conftest import register_and_login
from tests.helpers import HOT, ingest, provision, user_with_device


@pytest.fixture
def no_cooldown(monkeypatch):
    monkeypatch.setattr(settings, "ALERT_COOLDOWN_SECONDS", 0)


def _alerts(client, headers, path, **params):
    response = client.get(path, headers=headers, params=params)
    assert response.status_code == 200, response.text
    return response.json(), int(response.headers["X-Total-Count"])


def test_each_threshold_rule(client):
    headers, device_id, key = user_with_device(client, "t@example.com")
    ingest(client, key, temperature=70.0, battery=20, cpu_usage=90.0, ram_usage=90.0)  # exactly at limits
    assert _alerts(client, headers, f"/alerts/{device_id}")[1] == 0

    ingest(client, key, temperature=70.1, battery=19, cpu_usage=90.1, ram_usage=90.1)
    alerts, total = _alerts(client, headers, f"/alerts/{device_id}")
    assert total == 4
    by_type = {a["alert_type"]: a for a in alerts}
    assert by_type["TEMPERATURE"]["severity"] == "CRITICAL"
    assert {by_type[t]["severity"] for t in ("BATTERY", "CPU", "RAM")} == {"HIGH"}
    assert all(a["status"] == "active" and a["telemetry_id"] for a in alerts)


def test_cooldown_suppresses_repeats_across_readings(client):
    headers, device_id, key = user_with_device(client, "cd@example.com")
    ingest(client, key, **HOT)
    ingest(client, key, **HOT)
    assert _alerts(client, headers, f"/alerts/{device_id}")[1] == 1


def test_new_reading_after_cooldown_raises_new_alert(client, no_cooldown):
    headers, device_id, key = user_with_device(client, "cd2@example.com")
    ingest(client, key, **HOT)
    ingest(client, key, **HOT)
    assert _alerts(client, headers, f"/alerts/{device_id}")[1] == 2


def test_check_never_duplicates_alerts_for_the_same_reading(client, no_cooldown):
    """Regression: previously each /check after the cooldown re-alerted the same reading."""
    headers, device_id, key = user_with_device(client, "dup@example.com")
    ingest(client, key, temperature=85.0, battery=10)
    assert _alerts(client, headers, f"/alerts/{device_id}")[1] == 2

    for _ in range(3):
        checked = client.post(f"/alerts/check/{device_id}", headers=headers)
        assert checked.status_code == 200 and checked.json() == []

    assert _alerts(client, headers, f"/alerts/{device_id}")[1] == 2


def test_check_evaluates_an_unevaluated_reading_once(client, db_session, no_cooldown):
    headers, device_id, _ = user_with_device(client, "uneval@example.com")
    db_session.add(Telemetry(device_id=device_id, temperature=90, battery=50, cpu_usage=1, ram_usage=1))
    db_session.commit()

    first = client.post(f"/alerts/check/{device_id}", headers=headers).json()
    second = client.post(f"/alerts/check/{device_id}", headers=headers).json()
    assert [a["alert_type"] for a in first] == ["TEMPERATURE"]
    assert second == []


def test_database_rejects_second_alert_of_same_type_for_a_reading(client, db_session):
    headers, device_id, key = user_with_device(client, "uq@example.com")
    reading = ingest(client, key, **HOT)
    db_session.add(Alert(device_id=device_id, telemetry_id=reading["id"], alert_type="TEMPERATURE",
                         severity="CRITICAL", message="dup"))
    with pytest.raises(IntegrityError):
        db_session.commit()
    db_session.rollback()


def test_acknowledge_and_resolve_transitions(client):
    headers, device_id, key = user_with_device(client, "life@example.com")
    ingest(client, key, **HOT)
    alert_id = _alerts(client, headers, f"/alerts/{device_id}")[0][0]["id"]

    acked = client.post(f"/alerts/{alert_id}/acknowledge", headers=headers)
    assert acked.status_code == 200
    assert acked.json()["status"] == "acknowledged" and acked.json()["acknowledged_at"]
    assert client.post(f"/alerts/{alert_id}/acknowledge", headers=headers).json()["status"] == "acknowledged"

    resolved = client.post(f"/alerts/{alert_id}/resolve", headers=headers)
    assert resolved.json()["status"] == "resolved" and resolved.json()["resolved_at"]
    assert resolved.json()["acknowledged_at"] == acked.json()["acknowledged_at"]
    assert client.post(f"/alerts/{alert_id}/resolve", headers=headers).status_code == 200  # idempotent
    assert client.post(f"/alerts/{alert_id}/acknowledge", headers=headers).status_code == 409


def test_resolve_directly_from_active(client):
    headers, device_id, key = user_with_device(client, "direct@example.com")
    ingest(client, key, **HOT)
    alert_id = _alerts(client, headers, f"/alerts/{device_id}")[0][0]["id"]
    body = client.post(f"/alerts/{alert_id}/resolve", headers=headers).json()
    assert body["status"] == "resolved" and body["acknowledged_at"] is None


def test_alerts_cannot_be_deleted_and_others_get_404(client):
    headers, device_id, key = user_with_device(client, "nodel@example.com")
    ingest(client, key, **HOT)
    alert_id = _alerts(client, headers, f"/alerts/{device_id}")[0][0]["id"]
    other = register_and_login(client, "nodel-other@example.com")

    assert client.delete(f"/alerts/{alert_id}", headers=headers).status_code == 409
    assert client.delete(f"/alerts/{alert_id}", headers=other).status_code == 404
    assert client.post(f"/alerts/{alert_id}/acknowledge", headers=other).status_code == 404
    assert client.post(f"/alerts/{alert_id}/resolve", headers=other).status_code == 404
    assert client.post("/alerts/999999/resolve", headers=headers).status_code == 404
    assert _alerts(client, headers, f"/alerts/{device_id}")[0][0]["status"] == "active"


def test_server_side_filters_and_pagination(client, db_session, no_cooldown):
    headers, device_id, key = user_with_device(client, "filt@example.com")
    for _ in range(3):
        ingest(client, key, temperature=85.0, cpu_usage=95.0)  # CRITICAL TEMPERATURE + HIGH CPU each time
    path = f"/alerts/{device_id}"

    assert _alerts(client, headers, path)[1] == 6
    crit, total = _alerts(client, headers, path, severity="CRITICAL")
    assert total == 3 and {a["severity"] for a in crit} == {"CRITICAL"}
    assert _alerts(client, headers, path, severity="critical")[1] == 3  # case-insensitive
    assert _alerts(client, headers, path, alert_type="CPU")[1] == 3
    assert _alerts(client, headers, path, alert_type=["CPU", "TEMPERATURE"])[1] == 6

    first_id = _alerts(client, headers, path)[0][0]["id"]
    client.post(f"/alerts/{first_id}/resolve", headers=headers)
    assert _alerts(client, headers, path, status="resolved")[1] == 1
    assert _alerts(client, headers, path, status=["active", "acknowledged"])[1] == 5

    page1, total = _alerts(client, headers, path, limit=4, offset=0)
    page2, _ = _alerts(client, headers, path, limit=4, offset=4)
    assert total == 6 and len(page1) == 4 and len(page2) == 2
    ids = [a["id"] for a in page1 + page2]
    assert len(set(ids)) == 6
    created = [a["created_at"] for a in page1 + page2]
    assert created == sorted(created, reverse=True)

    future = (utc_now() + timedelta(days=1)).isoformat()
    assert _alerts(client, headers, path, since=future)[1] == 0
    assert _alerts(client, headers, path, until=future)[1] == 6

    for bad in ({"status": "open"}, {"limit": 501}, {"limit": 0}, {"offset": -1}, {"since": "nope"},
                {"severity": ["x"] * 11}):
        assert client.get(path, headers=headers, params=bad).status_code == 422, bad


def test_fleet_endpoint_is_scoped_to_the_current_user(client):
    headers_a, device_a1, key_a1 = user_with_device(client, "fa@example.com")
    device_a2, key_a2, _ = provision(client, headers_a, display_name="Second")
    headers_b, device_b, key_b = user_with_device(client, "fb@example.com")
    ingest(client, key_a1, **HOT)
    ingest(client, key_a2, battery=5)
    ingest(client, key_b, **HOT)

    alerts, total = _alerts(client, headers_a, "/alerts/")
    assert total == 2 and {a["device_id"] for a in alerts} == {device_a1, device_a2}

    scoped, total = _alerts(client, headers_a, "/alerts/", device_id=device_a2)
    assert total == 1 and scoped[0]["alert_type"] == "BATTERY"

    # Asking the fleet endpoint for someone else's device yields nothing.
    assert _alerts(client, headers_a, "/alerts/", device_id=device_b)[1] == 0
    assert client.get(f"/alerts/{device_b}", headers=headers_a).status_code == 404
    assert client.get("/alerts/").status_code == 401
