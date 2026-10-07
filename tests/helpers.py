from datetime import datetime, timedelta, timezone

import jwt

from app.core.config import settings
from tests.conftest import register_and_login

DEVICE_PAYLOAD = {
    "display_name": "Lab Sensor",
    "device_type": "ESP32",
    "manufacturer": "Espressif",
    "model": "WROOM",
}

NORMAL = {"temperature": 31.5, "battery": 88, "cpu_usage": 22.0, "ram_usage": 30.0}
HOT = {"temperature": 85.0, "battery": 50, "cpu_usage": 20.0, "ram_usage": 20.0}


def provision(client, headers, **overrides):
    """Register a device; returns (device_id, raw_key, provision body)."""
    response = client.post("/devices/", json={**DEVICE_PAYLOAD, **overrides}, headers=headers)
    assert response.status_code == 201, response.text
    body = response.json()
    return body["device"]["id"], body["device_key"], body


def user_with_device(client, email, **overrides):
    headers = register_and_login(client, email)
    device_id, key, _ = provision(client, headers, **overrides)
    return headers, device_id, key


def ingest(client, key, **values):
    response = client.post("/telemetry/", json={**NORMAL, **values}, headers={"X-DEVICE-KEY": key})
    assert response.status_code == 200, response.text
    return response.json()


def make_token(sub: str | None = "1", *, minutes: float = 30, extra: dict | None = None, secret: str | None = None) -> str:
    payload = dict(extra or {})
    if sub is not None:
        payload["sub"] = sub
    payload["exp"] = datetime.now(timezone.utc) + timedelta(minutes=minutes)
    return jwt.encode(payload, secret or settings.SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def user_id_of(client, headers) -> int:
    return client.get("/users/me", headers=headers).json()["id"]
