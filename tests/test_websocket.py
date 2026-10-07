import asyncio
import json
import time
from datetime import timedelta

import pytest
from starlette.websockets import WebSocketDisconnect

from app.core.config import settings
from app.models.device import Device
from app.realtime.hub import QUEUE_SIZE, Connection, RealtimeHub, hub
from app.services import device_monitor
from app.utils.time import utc_now
from tests.conftest import TestingSessionLocal, register_and_login
from tests.helpers import HOT, ingest, make_token, provision, user_id_of, user_with_device


_open_sessions: list = []


@pytest.fixture(autouse=True)
def _close_sockets(request):
    """Close any socket a failed test left open, so teardown cannot hang.
    Requesting `client` first makes this run before the TestClient shuts down."""
    if "client" in request.fixturenames:
        request.getfixturevalue("client")
    yield
    while _open_sessions:
        ws = _open_sessions.pop()
        try:
            _open_sessions.remove(ws)
            ws.__exit__(None, None, None)
        except Exception:
            pass


def _token(headers) -> str:
    return headers["Authorization"].split(" ", 1)[1]


def _connect(client, headers):
    ws = client.websocket_connect("/ws")
    socket = ws.__enter__()
    _open_sessions.append(ws)
    socket.send_json({"type": "auth", "token": _token(headers)})
    ready = socket.receive_json()
    assert ready["type"] == "ready"
    return ws, socket, ready


def _assert_nothing_pending(socket):
    """Ping and require the very next message to be the pong (no other event queued before it)."""
    socket.send_json({"type": "ping"})
    assert socket.receive_json() == {"type": "pong"}


def _close_code(socket) -> int:
    with pytest.raises(WebSocketDisconnect) as info:
        socket.receive_json()
    return info.value.code


# ------------------------------------------------------------- authentication

def test_rejects_missing_or_bad_auth(client):
    register_and_login(client, "ws0@example.com")
    for first_message in ({"type": "hello"}, {"type": "auth"}, {"type": "auth", "token": ""},
                          {"type": "auth", "token": "garbage"}, {"type": "auth", "token": make_token("999")}):
        with client.websocket_connect("/ws") as socket:
            socket.send_json(first_message)
            assert _close_code(socket) == 4401, first_message

    with client.websocket_connect("/ws") as socket:
        socket.send_text("not json")
        assert _close_code(socket) == 4401


def test_rejects_expired_token(client):
    headers = register_and_login(client, "ws-exp@example.com")
    expired = make_token(str(user_id_of(client, headers)), minutes=-1)
    with client.websocket_connect("/ws") as socket:
        socket.send_json({"type": "auth", "token": expired})
        assert _close_code(socket) == 4401
    assert hub.connection_count() == 0


def test_auth_timeout(client, monkeypatch):
    monkeypatch.setattr(settings, "WS_AUTH_TIMEOUT_SECONDS", 0.3)
    with client.websocket_connect("/ws") as socket:
        assert _close_code(socket) == 4408


def test_accepts_valid_token_and_reports_identity(client):
    headers = register_and_login(client, "ws1@example.com")
    ws, socket, ready = _connect(client, headers)
    assert ready["user_id"] == user_id_of(client, headers)
    assert ready["v"] == 1 and ready["expires_at"] > time.time()
    assert hub.connection_count(ready["user_id"]) == 1
    _assert_nothing_pending(socket)
    _open_sessions.remove(ws)
    ws.__exit__(None, None, None)


def test_session_closes_when_token_expires(client):
    headers = register_and_login(client, "ws-ttl@example.com")
    short = make_token(str(user_id_of(client, headers)), minutes=2 / 60)  # ~2 seconds
    with client.websocket_connect("/ws") as socket:
        socket.send_json({"type": "auth", "token": short})
        assert socket.receive_json()["type"] == "ready"
        assert _close_code(socket) == 4401


# --------------------------------------------------------------------- events

def test_telemetry_status_and_alert_events(client):
    headers, device_id, key = user_with_device(client, "ev@example.com")
    ws, socket, _ = _connect(client, headers)

    reading = ingest(client, key, **HOT)

    telemetry = socket.receive_json()
    assert telemetry["type"] == "telemetry" and telemetry["device_id"] == device_id
    assert telemetry["data"] == reading
    assert telemetry["v"] == 1 and telemetry["ts"]

    status = socket.receive_json()
    assert status["type"] == "device.status"
    assert status["data"]["status"] == "Online" and status["data"]["last_seen"] == reading["created_at"]

    alert = socket.receive_json()
    assert alert["type"] == "alert.created"
    assert alert["data"]["alert_type"] == "TEMPERATURE"
    assert alert["data"]["status"] == "active" and alert["data"]["telemetry_id"] == reading["id"]

    _assert_nothing_pending(socket)

    # Already Online: a second reading sends telemetry only (cooldown: no alert).
    ingest(client, key, **HOT)
    assert socket.receive_json()["type"] == "telemetry"
    _assert_nothing_pending(socket)

    # Lifecycle changes are pushed too.
    client.post(f"/alerts/{alert['data']['id']}/acknowledge", headers=headers)
    updated = socket.receive_json()
    assert updated["type"] == "alert.updated" and updated["data"]["status"] == "acknowledged"
    _open_sessions.remove(ws)
    ws.__exit__(None, None, None)


def test_device_lifecycle_events_never_contain_keys(client):
    headers = register_and_login(client, "evd@example.com")
    ws, socket, _ = _connect(client, headers)

    device_id, key, _ = provision(client, headers)
    created = socket.receive_json()
    assert created["type"] == "device.created" and created["device_id"] == device_id

    new_key = client.post(f"/devices/{device_id}/rotate-key", headers=headers).json()["device_key"]
    rotated = socket.receive_json()
    assert rotated["type"] == "device.updated"

    client.delete(f"/devices/{device_id}", headers=headers)
    deleted = socket.receive_json()
    assert deleted == {**deleted, "type": "device.deleted", "device_id": device_id, "data": None}

    for event in (created, rotated, deleted):
        raw = json.dumps(event)
        assert key not in raw and new_key not in raw
        assert "device_key" not in raw and "key_hash" not in raw and "token" not in raw
    _open_sessions.remove(ws)
    ws.__exit__(None, None, None)


def test_events_never_leak_to_other_users(client):
    headers_a, device_a, key_a = user_with_device(client, "iso-a@example.com")
    headers_b, device_b, key_b = user_with_device(client, "iso-b@example.com")
    ws_a, socket_a, _ = _connect(client, headers_a)
    ws_b, socket_b, _ = _connect(client, headers_b)

    ingest(client, key_a, **HOT)
    assert socket_a.receive_json()["device_id"] == device_a
    _assert_nothing_pending(socket_b)  # B saw nothing of A's telemetry, status or alert

    ingest(client, key_b)
    event = socket_b.receive_json()
    assert event["type"] == "telemetry" and event["device_id"] == device_b

    # Drain A's remaining events from its own reading, then confirm none of B's arrived.
    assert socket_a.receive_json()["type"] == "device.status"
    assert socket_a.receive_json()["type"] == "alert.created"
    _assert_nothing_pending(socket_a)

    _open_sessions.remove(ws_a)

    ws_a.__exit__(None, None, None)
    _open_sessions.remove(ws_b)
    ws_b.__exit__(None, None, None)


def test_multiple_clients_and_disconnect_cleanup(client):
    headers, device_id, key = user_with_device(client, "multi@example.com")
    user_id = user_id_of(client, headers)
    ws1, socket1, _ = _connect(client, headers)
    ws2, socket2, _ = _connect(client, headers)
    assert hub.connection_count(user_id) == 2

    ingest(client, key)  # first reading: telemetry + device.status (Offline -> Online)
    for socket in (socket1, socket2):
        assert socket.receive_json()["type"] == "telemetry"
        assert socket.receive_json()["type"] == "device.status"

    _open_sessions.remove(ws1)

    ws1.__exit__(None, None, None)
    # Cleanup happens when the server notices the disconnect.
    deadline = time.time() + 2
    while hub.connection_count(user_id) != 1 and time.time() < deadline:
        time.sleep(0.02)
    assert hub.connection_count(user_id) == 1

    ingest(client, key)
    assert socket2.receive_json()["type"] == "telemetry"  # survivor still served
    _open_sessions.remove(ws2)
    ws2.__exit__(None, None, None)
    deadline = time.time() + 2
    while hub.connection_count(user_id) and time.time() < deadline:
        time.sleep(0.02)
    assert hub.connection_count(user_id) == 0


def test_heartbeat(client, monkeypatch):
    monkeypatch.setattr(settings, "WS_HEARTBEAT_SECONDS", 0.2)
    headers = register_and_login(client, "hb@example.com")
    ws, socket, _ = _connect(client, headers)
    assert socket.receive_json() == {"type": "ping"}
    _open_sessions.remove(ws)
    ws.__exit__(None, None, None)


def test_device_monitor_publishes_offline_status(client, db_session, monkeypatch):
    headers, device_id, key = user_with_device(client, "mon@example.com")
    ingest(client, key)
    device = db_session.get(Device, device_id)
    device.last_seen = utc_now() - timedelta(minutes=10)
    db_session.commit()

    ws, socket, _ = _connect(client, headers)
    monkeypatch.setattr(device_monitor, "SessionLocal", TestingSessionLocal)
    assert device_monitor.mark_offline_devices() == 1

    event = socket.receive_json()
    assert event["type"] == "device.status" and event["device_id"] == device_id
    assert event["data"]["status"] == "Offline"
    _open_sessions.remove(ws)
    ws.__exit__(None, None, None)


# ------------------------------------------------------------------ hub unit

class _FakeSocket:
    def __init__(self):
        self.closed_with = None

    async def close(self, code, reason=""):
        self.closed_with = code


def test_hub_disconnects_slow_consumers_without_blocking_others():
    async def scenario():
        test_hub = RealtimeHub()
        test_hub.bind_loop(asyncio.get_running_loop())
        slow, fast = Connection(_FakeSocket(), user_id=1), Connection(_FakeSocket(), user_id=1)
        other_user = Connection(_FakeSocket(), user_id=2)
        for conn in (slow, fast, other_user):
            test_hub.register(conn)

        for i in range(QUEUE_SIZE + 5):
            test_hub.publish(1, {"n": i})
            await asyncio.sleep(0)
            if fast.queue.qsize():
                fast.queue.get_nowait()  # fast client keeps up
        await asyncio.sleep(0.01)

        assert slow.overflowed and slow.websocket.closed_with == 4008
        assert not fast.overflowed and fast.websocket.closed_with is None
        assert other_user.queue.qsize() == 0  # never received user 1's events
        assert test_hub.connection_count(1) == 1

    asyncio.run(scenario())


def test_publish_without_bound_loop_is_a_noop():
    RealtimeHub().publish(1, {"type": "telemetry"})  # must not raise
