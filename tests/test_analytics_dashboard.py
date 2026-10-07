from datetime import timedelta

from app.models.telemetry import Telemetry
from app.utils.time import utc_now
from tests.conftest import register_and_login
from tests.helpers import HOT, ingest, provision, user_with_device


def test_analytics_aggregation_accuracy(client):
    headers, device_id, key = user_with_device(client, "an@example.com")
    for temperature, battery, cpu, ram in ((20.0, 90, 10.0, 40.0), (30.0, 80, 20.0, 50.0), (40.0, 70, 60.0, 60.0)):
        ingest(client, key, temperature=temperature, battery=battery, cpu_usage=cpu, ram_usage=ram)

    body = client.get(f"/analytics/device/{device_id}", headers=headers).json()
    assert body["records"] == 3
    assert body["average_temperature"] == 30.0
    assert body["minimum_temperature"] == 20.0 and body["maximum_temperature"] == 40.0
    assert body["average_battery"] == 80.0
    assert body["average_cpu"] == 30.0
    assert body["average_ram"] == 50.0
    assert body["last_updated"] is not None


def test_analytics_without_telemetry_and_ownership(client):
    headers, device_id, _ = user_with_device(client, "an2@example.com")
    response = client.get(f"/analytics/device/{device_id}", headers=headers)
    assert response.status_code == 404
    assert response.json()["detail"] == "No telemetry found for this device"

    other = register_and_login(client, "an2-other@example.com")
    forbidden = client.get(f"/analytics/device/{device_id}", headers=other)
    assert forbidden.status_code == 404 and forbidden.json()["detail"] == "Device not found"


def test_dashboard_summary_counts_and_isolation(client, db_session):
    headers, d1, k1 = user_with_device(client, "dash@example.com")
    d2, k2, _ = provision(client, headers, display_name="Second")
    provision(client, headers, display_name="Never reports")
    ingest(client, k1, **HOT)            # CRITICAL temperature
    ingest(client, k2, battery=10)       # HIGH battery

    # Old reading (outside the last hour, inside 24h) for activity buckets.
    db_session.add(Telemetry(device_id=d2, temperature=25, battery=90, cpu_usage=5, ram_usage=5,
                             created_at=utc_now() - timedelta(hours=5), alerts_evaluated=True))
    db_session.commit()

    # Another user's fleet must not leak into these numbers.
    other_headers, _, other_key = user_with_device(client, "dash-other@example.com")
    ingest(client, other_key, **HOT)

    summary = client.get("/dashboard/summary", headers=headers)
    assert summary.status_code == 200
    s = summary.json()
    assert s["devices"] == {"total": 3, "online": 2, "offline": 1, "never_seen": 1}
    assert s["alerts"]["active_critical"] == 1
    assert s["alerts"]["active_high"] == 1
    assert s["alerts"]["active_total"] == 2
    assert s["alerts"]["devices_with_recent_alerts"] == 2
    assert s["telemetry"]["readings_last_hour"] == 2
    assert s["telemetry"]["readings_last_24h"] == 3
    assert len(s["telemetry"]["hourly"]) == 24
    assert sum(h["readings"] for h in s["telemetry"]["hourly"]) == 3
    assert s["telemetry"]["hourly"][-1]["readings"] >= 1

    # Lifecycle changes are reflected: acknowledged stays open, resolved does not.
    alerts = client.get("/alerts/", headers=headers).json()
    critical = next(a for a in alerts if a["severity"] == "CRITICAL")
    high = next(a for a in alerts if a["severity"] == "HIGH")
    client.post(f"/alerts/{critical['id']}/acknowledge", headers=headers)
    client.post(f"/alerts/{high['id']}/resolve", headers=headers)
    s = client.get("/dashboard/summary", headers=headers).json()
    assert s["alerts"]["active_critical"] == 1 and s["alerts"]["acknowledged"] == 1
    assert s["alerts"]["active_high"] == 0 and s["alerts"]["active_total"] == 1

    other = client.get("/dashboard/summary", headers=other_headers).json()
    assert other["devices"]["total"] == 1 and other["alerts"]["active_critical"] == 1

    assert client.get("/dashboard/summary").status_code == 401


def test_dashboard_summary_for_empty_account(client):
    headers = register_and_login(client, "empty@example.com")
    s = client.get("/dashboard/summary", headers=headers).json()
    assert s["devices"] == {"total": 0, "online": 0, "offline": 0, "never_seen": 0}
    assert s["alerts"]["active_total"] == 0
    assert s["telemetry"]["last_reading_at"] is None
    assert all(h["readings"] == 0 for h in s["telemetry"]["hourly"])
