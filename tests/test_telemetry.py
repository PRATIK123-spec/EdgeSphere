from tests.conftest import register_and_login

DEVICE_PAYLOAD = {
    "display_name": "Lab Sensor",
    "device_type": "ESP32",
    "manufacturer": "Espressif",
    "model": "WROOM",
}

TELEMETRY_PAYLOAD = {
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


def test_device_can_post_telemetry_with_valid_key(client):
    headers, device_id, device_key = _provision_device(
        client,
        "device-owner@example.com",
    )

    created = client.get(f"/devices/{device_id}", headers=headers)
    assert created.json()["status"] == "Offline"

    response = client.post(
        "/telemetry/",
        json=TELEMETRY_PAYLOAD,
        headers={"X-DEVICE-KEY": device_key},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["device_id"] == device_id
    assert body["temperature"] == 31.5

    updated = client.get(f"/devices/{device_id}", headers=headers)
    assert updated.status_code == 200
    assert updated.json()["status"] == "Online"
    assert updated.json()["last_seen"] is not None


def test_invalid_device_key_returns_401(client):
    response = client.post(
        "/telemetry/",
        json=TELEMETRY_PAYLOAD,
        headers={"X-DEVICE-KEY": "edg_invalid"},
    )

    assert response.status_code == 401


def test_user_cannot_access_another_users_telemetry(client):
    owner_headers, device_id, device_key = _provision_device(
        client,
        "telemetry-owner@example.com",
    )
    other_headers = register_and_login(client, "telemetry-other@example.com")

    posted = client.post(
        "/telemetry/",
        json=TELEMETRY_PAYLOAD,
        headers={"X-DEVICE-KEY": device_key},
    )
    assert posted.status_code == 200
    telemetry_id = posted.json()["id"]

    history = client.get(f"/telemetry/{device_id}", headers=other_headers)
    assert history.status_code == 404

    latest = client.get(f"/telemetry/latest/{device_id}", headers=other_headers)
    assert latest.status_code == 404

    deleted = client.delete(f"/telemetry/{telemetry_id}", headers=other_headers)
    assert deleted.status_code == 404

    owner_history = client.get(f"/telemetry/{device_id}", headers=owner_headers)
    assert owner_history.status_code == 200
    assert len(owner_history.json()) == 1

    unauthenticated = client.get(f"/telemetry/{device_id}")
    assert unauthenticated.status_code == 401
