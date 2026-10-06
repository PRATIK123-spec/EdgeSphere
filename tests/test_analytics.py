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


def test_owner_can_read_device_analytics(client):
    headers = register_and_login(client, "analytics-owner@example.com")
    created = client.post("/devices/", json=DEVICE_PAYLOAD, headers=headers)
    device_id = created.json()["device"]["id"]
    device_key = created.json()["device_key"]

    posted = client.post(
        "/telemetry/",
        json=TELEMETRY_PAYLOAD,
        headers={"X-DEVICE-KEY": device_key},
    )
    assert posted.status_code == 200

    analytics = client.get(
        f"/analytics/device/{device_id}",
        headers=headers,
    )
    assert analytics.status_code == 200
    body = analytics.json()
    assert body["device_id"] == device_id
    assert body["records"] == 1


def test_user_cannot_read_another_users_analytics(client):
    owner_headers = register_and_login(client, "analytics-a@example.com")
    other_headers = register_and_login(client, "analytics-b@example.com")

    created = client.post("/devices/", json=DEVICE_PAYLOAD, headers=owner_headers)
    device_id = created.json()["device"]["id"]
    device_key = created.json()["device_key"]

    client.post(
        "/telemetry/",
        json=TELEMETRY_PAYLOAD,
        headers={"X-DEVICE-KEY": device_key},
    )

    response = client.get(
        f"/analytics/device/{device_id}",
        headers=other_headers,
    )
    assert response.status_code == 404

    unauthenticated = client.get(f"/analytics/device/{device_id}")
    assert unauthenticated.status_code == 401
