from tests.conftest import register_and_login

DEVICE_PAYLOAD = {
    "display_name": "Lab Sensor",
    "device_type": "ESP32",
    "manufacturer": "Espressif",
    "model": "WROOM",
}

HOT_TELEMETRY = {
    "temperature": 85.0,
    "battery": 50,
    "cpu_usage": 20.0,
    "ram_usage": 20.0,
}

NORMAL_TELEMETRY = {
    "temperature": 31.5,
    "battery": 88,
    "cpu_usage": 22.0,
    "ram_usage": 30.0,
}


def _provision_device(client, email: str):
    headers = register_and_login(client, email)
    created = client.post("/devices/", json=DEVICE_PAYLOAD, headers=headers)
    assert created.status_code == 201
    body = created.json()
    return headers, body["device"]["id"], body["device_key"]


def test_hot_telemetry_creates_alert_on_ingest(client):
    headers, device_id, device_key = _provision_device(
        client,
        "alert-ingest@example.com",
    )

    posted = client.post(
        "/telemetry/",
        json=HOT_TELEMETRY,
        headers={"X-DEVICE-KEY": device_key},
    )
    assert posted.status_code == 200

    listed = client.get(f"/alerts/{device_id}", headers=headers)
    assert listed.status_code == 200
    alerts = listed.json()
    assert len(alerts) == 1
    assert alerts[0]["alert_type"] == "TEMPERATURE"


def test_repeated_hot_telemetry_does_not_duplicate_alerts(client):
    headers, device_id, device_key = _provision_device(
        client,
        "alert-dedupe@example.com",
    )

    first = client.post(
        "/telemetry/",
        json=HOT_TELEMETRY,
        headers={"X-DEVICE-KEY": device_key},
    )
    second = client.post(
        "/telemetry/",
        json=HOT_TELEMETRY,
        headers={"X-DEVICE-KEY": device_key},
    )
    assert first.status_code == 200
    assert second.status_code == 200

    listed = client.get(f"/alerts/{device_id}", headers=headers)
    assert listed.status_code == 200
    assert len(listed.json()) == 1

    checked = client.post(f"/alerts/check/{device_id}", headers=headers)
    assert checked.status_code == 200
    assert checked.json() == []


def test_normal_telemetry_does_not_create_alerts(client):
    headers, device_id, device_key = _provision_device(
        client,
        "alert-normal@example.com",
    )

    posted = client.post(
        "/telemetry/",
        json=NORMAL_TELEMETRY,
        headers={"X-DEVICE-KEY": device_key},
    )
    assert posted.status_code == 200

    listed = client.get(f"/alerts/{device_id}", headers=headers)
    assert listed.status_code == 200
    assert listed.json() == []


def test_user_cannot_access_another_users_alerts(client):
    owner_headers, device_id, device_key = _provision_device(
        client,
        "alert-owner-a@example.com",
    )
    other_headers = register_and_login(client, "alert-owner-b@example.com")

    client.post(
        "/telemetry/",
        json=HOT_TELEMETRY,
        headers={"X-DEVICE-KEY": device_key},
    )

    listed = client.get(f"/alerts/{device_id}", headers=owner_headers)
    assert listed.status_code == 200
    alert_id = listed.json()[0]["id"]

    other_list = client.get(f"/alerts/{device_id}", headers=other_headers)
    assert other_list.status_code == 404

    check = client.post(f"/alerts/check/{device_id}", headers=other_headers)
    assert check.status_code == 404

    deleted = client.delete(f"/alerts/{alert_id}", headers=other_headers)
    assert deleted.status_code == 404

    unauthenticated = client.get(f"/alerts/{device_id}")
    assert unauthenticated.status_code == 401
