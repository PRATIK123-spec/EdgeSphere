from datetime import datetime, timedelta

from app.models.telemetry import Telemetry
from tests.helpers import user_with_device

BASE = datetime(2026, 2, 1, 8, 0, 0)


def _add(db_session, device_id, offset_seconds, temperature, battery=80, cpu=10.0, ram=20.0):
    db_session.add(
        Telemetry(
            device_id=device_id,
            temperature=temperature,
            battery=battery,
            cpu_usage=cpu,
            ram_usage=ram,
            created_at=BASE + timedelta(seconds=offset_seconds),
            alerts_evaluated=True,
        )
    )


def test_series_aggregates_buckets_accurately(client, db_session):
    headers, device_id, _ = user_with_device(client, "s1@example.com")
    # Bucket 0 (0-59s): temps 10, 20 ; bucket 1 (60-119s): 30 ; bucket 3 (180-239s): 50
    _add(db_session, device_id, 0, 10, battery=90, cpu=10)
    _add(db_session, device_id, 30, 20, battery=70, cpu=30)
    _add(db_session, device_id, 60, 30)
    _add(db_session, device_id, 200, 50)
    db_session.commit()

    response = client.get(
        f"/telemetry/{device_id}/series?since=2026-02-01T08:00:00&until=2026-02-01T08:04:00&max_points=4",
        headers=headers,
    )
    assert response.status_code == 200
    body = response.json()
    assert body["bucket_seconds"] == 60
    assert body["readings"] == 4
    points = body["points"]
    assert [p["bucket_start"] for p in points] == [
        "2026-02-01T08:00:00", "2026-02-01T08:01:00", "2026-02-01T08:03:00",
    ]  # empty bucket (08:02) is omitted, so charts show a gap
    first = points[0]
    assert first["count"] == 2
    assert first["avg_temperature"] == 15 and first["min_temperature"] == 10 and first["max_temperature"] == 20
    assert first["avg_battery"] == 80 and first["min_battery"] == 70 and first["max_battery"] == 90
    assert first["avg_cpu_usage"] == 20
    assert points[2]["max_temperature"] == 50


def test_series_never_exceeds_max_points(client, db_session):
    headers, device_id, _ = user_with_device(client, "s2@example.com")
    for i in range(1200):
        _add(db_session, device_id, i * 5, 20 + (i % 10))
    db_session.commit()

    body = client.get(f"/telemetry/{device_id}/series?max_points=50", headers=headers).json()
    assert len(body["points"]) <= 50
    assert body["readings"] == 1200
    assert body["since"] == "2026-02-01T08:00:00"  # defaults to the first reading


def test_series_empty_and_invalid(client):
    headers, device_id, _ = user_with_device(client, "s3@example.com")
    empty = client.get(f"/telemetry/{device_id}/series", headers=headers)
    assert empty.status_code == 200 and empty.json()["points"] == [] and empty.json()["readings"] == 0
    for query in ("max_points=0", "max_points=1001", "since=garbage",
                  "since=2026-02-01T09:00:00&until=2026-02-01T08:00:00"):
        assert client.get(f"/telemetry/{device_id}/series?{query}", headers=headers).status_code == 422, query
