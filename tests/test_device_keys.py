import hashlib

from sqlalchemy import inspect, text

from app.models.device import Device
from tests.helpers import NORMAL, ingest, user_with_device


def _post(client, key):
    return client.post("/telemetry/", json=NORMAL, headers={"X-DEVICE-KEY": key})


def test_valid_key_authenticates_and_invalid_keys_fail(client):
    _, _, key = user_with_device(client, "k1@example.com")
    assert _post(client, key).status_code == 200
    assert _post(client, key + "x").status_code == 401
    assert _post(client, key[:-1]).status_code == 401
    assert _post(client, "edg_" + "0" * 64).status_code == 401
    assert client.post("/telemetry/", json=NORMAL).status_code == 401  # header missing
    assert _post(client, "edg_" + "a" * 5000).status_code == 401  # oversized


def test_raw_key_is_never_stored(client, db_session):
    _, device_id, key = user_with_device(client, "k2@example.com")

    columns = {c["name"] for c in inspect(db_session.bind).get_columns("devices")}
    assert "device_key" not in columns

    device = db_session.get(Device, device_id)
    assert device.key_hash == hashlib.sha256(key.encode()).hexdigest()
    assert key not in device.key_prefix and len(device.key_prefix) == 12

    # No stored value anywhere in the row contains the raw key.
    row = db_session.execute(text("SELECT * FROM devices WHERE id = :id"), {"id": device_id}).mappings().one()
    assert not any(isinstance(v, str) and key in v for v in row.values())

    # The model offers no way to read a raw key back.
    try:
        _ = device.device_key
        raise AssertionError("device_key must not be readable")
    except AttributeError:
        pass


def test_rotation_invalidates_old_key_and_returns_new_key_once(client):
    headers, device_id, old_key = user_with_device(client, "k3@example.com")
    ingest(client, old_key)

    rotated = client.post(f"/devices/{device_id}/rotate-key", headers=headers)
    assert rotated.status_code == 200
    body = rotated.json()
    new_key = body["device_key"]
    assert new_key != old_key and new_key.startswith("edg_")
    assert body["device"]["id"] == device_id
    assert body["device"]["key_prefix"] == new_key[:12]

    assert _post(client, old_key).status_code == 401
    assert _post(client, new_key).status_code == 200

    # Never returned again.
    for response in (client.get(f"/devices/{device_id}", headers=headers), client.get("/devices/", headers=headers)):
        assert new_key not in response.text and "device_key" not in response.text

    # History survives rotation.
    assert client.get(f"/telemetry/{device_id}", headers=headers).headers["X-Total-Count"] == "2"


def test_rotating_twice_invalidates_every_previous_key(client):
    headers, device_id, key1 = user_with_device(client, "k4@example.com")
    key2 = client.post(f"/devices/{device_id}/rotate-key", headers=headers).json()["device_key"]
    key3 = client.post(f"/devices/{device_id}/rotate-key", headers=headers).json()["device_key"]
    assert _post(client, key1).status_code == 401
    assert _post(client, key2).status_code == 401
    assert _post(client, key3).status_code == 200


def test_key_identifies_device_not_request_data(client):
    headers_a, device_a, key_a = user_with_device(client, "ka@example.com")
    headers_b, device_b, _ = user_with_device(client, "kb@example.com")
    # A device cannot claim another device's id: unknown fields are ignored and
    # the reading is attributed to the key's device.
    response = client.post("/telemetry/", json={**NORMAL, "device_id": device_b}, headers={"X-DEVICE-KEY": key_a})
    assert response.status_code == 200
    assert response.json()["device_id"] == device_a
    assert client.get(f"/telemetry/{device_b}", headers=headers_b).headers["X-Total-Count"] == "0"
