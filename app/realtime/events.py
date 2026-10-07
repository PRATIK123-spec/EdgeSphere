"""
Real-time event payloads and publishing helpers used by the services.

Envelope (protocol version 1):

    {
      "v": 1,
      "type": "telemetry" | "alert.created" | "alert.updated"
            | "device.status" | "device.created" | "device.updated" | "device.deleted",
      "device_id": 123,
      "ts": "2026-10-06T12:00:00.123456",      # server time, naive UTC like the REST API
      "data": { ... }                           # see below
    }

`data` is built from the existing response schemas (TelemetryResponse,
AlertResponse, DeviceResponse), so events can never carry fields the REST
API does not expose — in particular never device keys, JWTs or passwords.

Every event is published only to the owner of the device it concerns.
"""

from __future__ import annotations

from typing import Any, Iterable

from app.models.alert import Alert
from app.models.device import Device
from app.models.telemetry import Telemetry
from app.realtime.hub import hub
from app.schemas.alert import AlertResponse
from app.schemas.device import DeviceResponse
from app.schemas.telemetry import TelemetryResponse
from app.utils.time import utc_now

PROTOCOL_VERSION = 1


def _envelope(event_type: str, device_id: int, data: dict[str, Any] | None) -> dict[str, Any]:
    return {
        "v": PROTOCOL_VERSION,
        "type": event_type,
        "device_id": device_id,
        "ts": utc_now().isoformat(),
        "data": data,
    }


def publish_telemetry(owner_id: int, telemetry: Telemetry) -> None:
    hub.publish(
        owner_id,
        _envelope("telemetry", telemetry.device_id, TelemetryResponse.model_validate(telemetry).model_dump(mode="json")),
    )


def publish_alerts(owner_id: int, alerts: Iterable[Alert], *, created: bool) -> None:
    event_type = "alert.created" if created else "alert.updated"
    for alert in alerts:
        hub.publish(
            owner_id,
            _envelope(event_type, alert.device_id, AlertResponse.model_validate(alert).model_dump(mode="json")),
        )


def publish_device_status(owner_id: int, device_id: int, status: str, last_seen) -> None:
    hub.publish(
        owner_id,
        _envelope(
            "device.status",
            device_id,
            {"status": status, "last_seen": last_seen.isoformat() if last_seen else None},
        ),
    )


def publish_device(owner_id: int, device: Device, *, kind: str) -> None:
    """kind: 'created' | 'updated'."""
    hub.publish(
        owner_id,
        _envelope(f"device.{kind}", device.id, DeviceResponse.model_validate(device).model_dump(mode="json")),
    )


def publish_device_deleted(owner_id: int, device_id: int) -> None:
    hub.publish(owner_id, _envelope("device.deleted", device_id, None))
