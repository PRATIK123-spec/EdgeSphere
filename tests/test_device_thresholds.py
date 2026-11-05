import pytest

from app.core.alert_thresholds import DEFAULT_THRESHOLDS
from tests.conftest import register_and_login

DEVICE_PAYLOAD = {
    "display_name": "Threshold Sensor",
    "device_type": "ESP32",
    "manufacturer": "Espressif",
    "model": "WROOM",
}

NORMAL = {"temperature": 30.0, "battery": 80, "cpu_usage": 20.0, "ram_usage": 20.0}
DEFAULTS = {"temperature_max": 70.0, "battery_min": 20.0, "cpu_max": 90.0, "ram_max": 90.0}


def _provision(client, email):
    headers = register_and_login(client, email)
    created = client.post("/devices/", json=DEVICE_PAYLOAD, headers=headers)
    assert created.status_code == 201
    body = created.json()
    return headers, body["device"]["id"], body["device_key"]


def _ingest(client, key, **overrides):
    response = client.post("/telemetry/", json={**NORMAL, **overrides}, headers={"X-DEVICE-KEY": key})
    assert response.status_code == 200


def _alert_types(client, device_id, headers):
    return sorted(a["alert_type"] for a in client.get(f"/alerts/{device_id}", headers=headers).json())


# ------------------------------------------------------------------ API


def test_defaults_match_the_original_rules():
    assert DEFAULT_THRESHOLDS.as_dict() == DEFAULTS


def test_new_device_uses_default_thresholds(client):
    headers, device_id, _ = _provision(client, "th-defaults@example.com")

    response = client.get(f"/devices/{device_id}/thresholds", headers=headers)

    assert response.status_code == 200
    body = response.json()
    assert body["effective"] == DEFAULTS
    assert body["defaults"] == DEFAULTS
    assert body["overrides"] == {"temperature_max": None, "battery_min": None, "cpu_max": None, "ram_max": None}
    assert client.get(f"/devices/{device_id}", headers=headers).json()["alert_thresholds"] == DEFAULTS


def test_put_sets_overrides_and_null_resets_to_default(client):
    headers, device_id, _ = _provision(client, "th-put@example.com")

    put = client.put(
        f"/devices/{device_id}/thresholds",
        json={"temperature_max": 55.5, "battery_min": 35},
        headers=headers,
    )
    assert put.status_code == 200
    assert put.json()["effective"] == {**DEFAULTS, "temperature_max": 55.5, "battery_min": 35.0}
    assert put.json()["overrides"]["cpu_max"] is None

    device = client.get(f"/devices/{device_id}", headers=headers).json()
    assert device["alert_thresholds"]["temperature_max"] == 55.5
    listed = client.get("/devices/", headers=headers).json()
    assert listed[0]["alert_thresholds"]["battery_min"] == 35.0

    reset = client.put(f"/devices/{device_id}/thresholds", json={"temperature_max": None}, headers=headers)
    assert reset.status_code == 200
    assert reset.json()["effective"] == DEFAULTS


@pytest.mark.parametrize(
    "body",
    [
        {"battery_min": -1},
        {"cpu_max": 100.5},
        {"ram_max": "high"},
        {"temperature_max": 251},
        {"unknown": 1},
    ],
)
def test_put_rejects_out_of_range_or_unknown_fields(client, body):
    headers, device_id, _ = _provision(client, f"th-bad-{abs(hash(str(body)))}@example.com")

    response = client.put(f"/devices/{device_id}/thresholds", json=body, headers=headers)

    assert response.status_code == 422


def test_thresholds_are_owner_only(client):
    _, device_id, _ = _provision(client, "th-owner@example.com")
    other = register_and_login(client, "th-other@example.com")

    assert client.get(f"/devices/{device_id}/thresholds", headers=other).status_code == 404
    assert (
        client.put(f"/devices/{device_id}/thresholds", json={"cpu_max": 10}, headers=other).status_code == 404
    )
    assert client.get(f"/devices/{device_id}/thresholds").status_code == 401
    assert client.put(f"/devices/{device_id}/thresholds", json={}).status_code == 401


# --------------------------------------------------------- alert engine


def test_default_thresholds_unchanged_without_overrides(client):
    headers, device_id, key = _provision(client, "th-engine-default@example.com")

    _ingest(client, key, temperature=65.0, battery=25, cpu_usage=85.0, ram_usage=85.0)
    assert _alert_types(client, device_id, headers) == []

    _ingest(client, key, temperature=71.0)
    alerts = client.get(f"/alerts/{device_id}", headers=headers).json()
    assert [a["alert_type"] for a in alerts] == ["TEMPERATURE"]
    assert alerts[0]["message"] == "Temperature exceeded 70°C"


def test_alert_engine_uses_the_devices_own_thresholds(client):
    headers, device_id, key = _provision(client, "th-engine-custom@example.com")
    client.put(
        f"/devices/{device_id}/thresholds",
        json={"temperature_max": 50, "battery_min": 40, "cpu_max": 60, "ram_max": 70.5},
        headers=headers,
    )

    # All values are within the defaults but outside this device's thresholds.
    _ingest(client, key, temperature=55.0, battery=35, cpu_usage=65.0, ram_usage=71.0)

    alerts = {a["alert_type"]: a for a in client.get(f"/alerts/{device_id}", headers=headers).json()}
    assert sorted(alerts) == ["BATTERY", "CPU", "RAM", "TEMPERATURE"]
    assert alerts["TEMPERATURE"]["message"] == "Temperature exceeded 50°C"
    assert alerts["TEMPERATURE"]["severity"] == "CRITICAL"
    assert alerts["BATTERY"]["message"] == "Battery below 40%"
    assert alerts["RAM"]["message"] == "RAM usage above 70.5%"


def test_raised_threshold_suppresses_default_alert(client):
    headers, device_id, key = _provision(client, "th-engine-raised@example.com")
    client.put(f"/devices/{device_id}/thresholds", json={"temperature_max": 95}, headers=headers)

    _ingest(client, key, temperature=85.0)

    assert _alert_types(client, device_id, headers) == []


def test_thresholds_are_per_device(client):
    headers, strict_id, strict_key = _provision(client, "th-engine-per-device@example.com")
    created = client.post("/devices/", json=DEVICE_PAYLOAD, headers=headers).json()
    default_id, default_key = created["device"]["id"], created["device_key"]
    client.put(f"/devices/{strict_id}/thresholds", json={"cpu_max": 50}, headers=headers)

    _ingest(client, strict_key, cpu_usage=60.0)
    _ingest(client, default_key, cpu_usage=60.0)

    assert _alert_types(client, strict_id, headers) == ["CPU"]
    assert _alert_types(client, default_id, headers) == []


def test_threshold_event_never_contains_device_key(client):
    headers, device_id, key = _provision(client, "th-no-key@example.com")

    response = client.put(f"/devices/{device_id}/thresholds", json={"cpu_max": 50}, headers=headers)

    assert key not in response.text
    assert "key_hash" not in response.text
