from tests.conftest import register_and_login

DEVICE_PAYLOAD = {
    "display_name": "Lab Sensor",
    "device_type": "ESP32",
    "manufacturer": "Espressif",
    "model": "WROOM",
}


def test_device_creation_returns_key_once(client):
    headers = register_and_login(client, "owner@example.com")

    created = client.post("/devices/", json=DEVICE_PAYLOAD, headers=headers)

    assert created.status_code == 201
    body = created.json()
    assert "device_key" in body
    assert body["device_key"].startswith("edg_")
    assert body["device"]["display_name"] == "Lab Sensor"
    assert "device_key" not in body["device"]

    device_id = body["device"]["id"]

    listed = client.get("/devices/", headers=headers)
    assert listed.status_code == 200
    assert listed.json()[0]["id"] == device_id
    assert "device_key" not in listed.json()[0]

    fetched = client.get(f"/devices/{device_id}", headers=headers)
    assert fetched.status_code == 200
    assert "device_key" not in fetched.json()


def test_user_cannot_access_another_users_device(client):
    owner_headers = register_and_login(client, "owner-a@example.com")
    other_headers = register_and_login(client, "owner-b@example.com")

    created = client.post("/devices/", json=DEVICE_PAYLOAD, headers=owner_headers)
    device_id = created.json()["device"]["id"]

    listed = client.get("/devices/", headers=other_headers)
    assert listed.status_code == 200
    assert listed.json() == []

    fetched = client.get(f"/devices/{device_id}", headers=other_headers)
    assert fetched.status_code == 404

    updated = client.put(
        f"/devices/{device_id}",
        json={**DEVICE_PAYLOAD, "display_name": "Hijacked"},
        headers=other_headers,
    )
    assert updated.status_code == 404

    deleted = client.delete(f"/devices/{device_id}", headers=other_headers)
    assert deleted.status_code == 404

    still_there = client.get(f"/devices/{device_id}", headers=owner_headers)
    assert still_there.status_code == 200
    assert still_there.json()["display_name"] == "Lab Sensor"
