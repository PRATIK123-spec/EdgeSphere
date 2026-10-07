from app.models.alert import Alert
from app.models.telemetry import Telemetry
from tests.conftest import register_and_login
from tests.helpers import DEVICE_PAYLOAD, HOT, ingest, provision, user_with_device


def test_create_validation_rejects_bad_input(client):
    headers = register_and_login(client, "v@example.com")
    cases = [
        {**DEVICE_PAYLOAD, "display_name": ""},
        {**DEVICE_PAYLOAD, "display_name": "   "},
        {**DEVICE_PAYLOAD, "display_name": "x" * 101},
        {**DEVICE_PAYLOAD, "device_type": "x" * 51},
        {**DEVICE_PAYLOAD, "manufacturer": " "},
        {**DEVICE_PAYLOAD, "model": "bad\nmodel"},
        {**DEVICE_PAYLOAD, "status": "Online"},  # not client-settable
        {**DEVICE_PAYLOAD, "owner_id": 999},  # mass assignment
        {"display_name": "only name"},
    ]
    for payload in cases:
        assert client.post("/devices/", json=payload, headers=headers).status_code == 422, payload


def test_create_trims_whitespace_and_reports_never_seen(client):
    headers = register_and_login(client, "trim@example.com")
    _, _, body = provision(client, headers, display_name="  Rack 7  ")
    device = body["device"]
    assert device["display_name"] == "Rack 7"
    assert device["last_seen"] is None
    assert device["status"] == "Offline"
    assert device["created_at"]
    assert device["key_prefix"].startswith("edg_") and len(device["key_prefix"]) == 12
    assert body["device_key"].startswith(device["key_prefix"])


def test_first_telemetry_sets_last_seen_and_online(client):
    headers, device_id, key = user_with_device(client, "seen@example.com")
    reading = ingest(client, key)
    device = client.get(f"/devices/{device_id}", headers=headers).json()
    assert device["status"] == "Online"
    assert device["last_seen"] == reading["created_at"]


def test_put_requires_all_fields_patch_accepts_subset(client):
    headers, device_id, _ = user_with_device(client, "edit@example.com")

    assert client.put(f"/devices/{device_id}", json={"display_name": "x"}, headers=headers).status_code == 422

    patched = client.patch(f"/devices/{device_id}", json={"model": "WROOM-32E"}, headers=headers)
    assert patched.status_code == 200
    assert patched.json()["model"] == "WROOM-32E"
    assert patched.json()["display_name"] == DEVICE_PAYLOAD["display_name"]

    assert client.patch(f"/devices/{device_id}", json={}, headers=headers).status_code == 422
    assert client.patch(f"/devices/{device_id}", json={"model": None}, headers=headers).status_code == 422
    assert client.patch(f"/devices/{device_id}", json={"status": "Online"}, headers=headers).status_code == 422


def test_other_users_cannot_patch_rotate_or_delete(client):
    owner, device_id, _ = user_with_device(client, "own@example.com")
    other = register_and_login(client, "other@example.com")
    assert client.patch(f"/devices/{device_id}", json={"model": "x"}, headers=other).status_code == 404
    assert client.post(f"/devices/{device_id}/rotate-key", headers=other).status_code == 404
    assert client.delete(f"/devices/{device_id}", headers=other).status_code == 404
    assert client.get(f"/devices/{device_id}", headers=owner).status_code == 200


def test_delete_cascades_to_telemetry_and_alerts(client, db_session):
    headers, device_id, key = user_with_device(client, "del@example.com")
    ingest(client, key, **HOT)
    ingest(client, key)
    assert db_session.query(Telemetry).filter_by(device_id=device_id).count() == 2
    assert db_session.query(Alert).filter_by(device_id=device_id).count() == 1

    assert client.delete(f"/devices/{device_id}", headers=headers).status_code == 204

    db_session.expire_all()
    assert db_session.query(Telemetry).filter_by(device_id=device_id).count() == 0
    assert db_session.query(Alert).filter_by(device_id=device_id).count() == 0
    assert client.get(f"/devices/{device_id}", headers=headers).status_code == 404
    assert client.post("/telemetry/", json=HOT, headers={"X-DEVICE-KEY": key}).status_code == 401


def test_device_list_and_detail_never_include_key_material(client):
    headers, device_id, key = user_with_device(client, "nokey@example.com")
    for response in (client.get("/devices/", headers=headers), client.get(f"/devices/{device_id}", headers=headers)):
        text = response.text
        assert key not in text
        assert "device_key" not in text and "key_hash" not in text
