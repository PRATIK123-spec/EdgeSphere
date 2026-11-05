import threading
import time

import pytest

from app.core.config import settings
from app.notifications import dispatcher, email_sender, telegram_sender
from app.services import notification_service
from tests.conftest import register_and_login

DEVICE_PAYLOAD = {
    "display_name": "Pump Station 4",
    "device_type": "ESP32",
    "manufacturer": "Espressif",
    "model": "WROOM",
}
NORMAL = {"temperature": 30.0, "battery": 80, "cpu_usage": 20.0, "ram_usage": 20.0}
HOT = {**NORMAL, "temperature": 85.0}  # CRITICAL
LOW_BATTERY = {**NORMAL, "battery": 5}  # HIGH


@pytest.fixture(autouse=True)
def channels_off(monkeypatch):
    """Start every test with no channel configured, whatever the local .env says."""
    for name in ("SMTP_HOST", "SMTP_FROM", "SMTP_USERNAME", "SMTP_PASSWORD", "TELEGRAM_BOT_TOKEN", "FRONTEND_URL"):
        monkeypatch.setattr(settings, name, "")
    monkeypatch.setattr(notification_service, "_last_test_at", {})


@pytest.fixture
def configured(monkeypatch):
    monkeypatch.setattr(settings, "SMTP_HOST", "smtp.example.com")
    monkeypatch.setattr(settings, "SMTP_FROM", "alerts@example.com")
    monkeypatch.setattr(settings, "TELEGRAM_BOT_TOKEN", "123456:test-token")


@pytest.fixture
def sent(monkeypatch):
    """Mock both senders and deliver synchronously so tests can assert on calls."""
    calls = []
    monkeypatch.setattr(email_sender, "send", lambda to, subject, body: calls.append(("email", to, subject, body)))
    monkeypatch.setattr(telegram_sender, "send", lambda chat_id, text: calls.append(("telegram", chat_id, text)))
    monkeypatch.setattr(dispatcher, "submit", dispatcher.deliver)
    return calls


def _provision(client, email):
    headers = register_and_login(client, email)
    body = client.post("/devices/", json=DEVICE_PAYLOAD, headers=headers).json()
    return headers, body["device"]["id"], body["device_key"]


def _ingest(client, key, reading):
    response = client.post("/telemetry/", json=reading, headers={"X-DEVICE-KEY": key})
    assert response.status_code == 200
    return response


def _enable(client, headers, **overrides):
    body = {"email_enabled": True, "telegram_enabled": True, "telegram_chat_id": "-100123", **overrides}
    response = client.put("/users/me/notifications", json=body, headers=headers)
    assert response.status_code == 200, response.text
    return response.json()


# ------------------------------------------------------------- settings API


def test_defaults_are_off_and_report_unconfigured_channels(client):
    headers = register_and_login(client, "notify-defaults@example.com")

    body = client.get("/users/me/notifications", headers=headers).json()

    assert body == {
        "email_enabled": False,
        "telegram_enabled": False,
        "telegram_chat_id": None,
        "min_severity": "HIGH",
        "email_address": "notify-defaults@example.com",
        "email_available": False,
        "telegram_available": False,
    }


def test_cannot_enable_a_channel_the_server_has_not_configured(client):
    headers = register_and_login(client, "notify-unconfigured@example.com")

    email = client.put("/users/me/notifications", json={"email_enabled": True}, headers=headers)
    telegram = client.put(
        "/users/me/notifications", json={"telegram_enabled": True, "telegram_chat_id": "42"}, headers=headers
    )

    assert email.status_code == 409
    assert telegram.status_code == 409


def test_save_settings_when_configured(client, configured):
    headers = register_and_login(client, "notify-save@example.com")

    body = _enable(client, headers, min_severity="CRITICAL")

    assert body["email_enabled"] and body["telegram_enabled"]
    assert body["telegram_chat_id"] == "-100123"
    assert body["min_severity"] == "CRITICAL"
    assert body["email_available"] and body["telegram_available"]
    assert client.get("/users/me/notifications", headers=headers).json() == body


@pytest.mark.parametrize(
    "body",
    [
        {"telegram_enabled": True},  # chat id required
        {"telegram_enabled": True, "telegram_chat_id": "not a chat"},
        {"min_severity": "LOW"},
        {"email_address": "someone-else@example.com"},  # email always goes to the account
    ],
)
def test_invalid_settings_are_rejected(client, configured, body):
    headers = register_and_login(client, "notify-invalid@example.com")

    assert client.put("/users/me/notifications", json=body, headers=headers).status_code == 422


def test_settings_require_authentication(client):
    assert client.get("/users/me/notifications").status_code == 401
    assert client.put("/users/me/notifications", json={}).status_code == 401
    assert client.post("/users/me/notifications/test").status_code == 401


def test_settings_are_per_user(client, configured):
    a = register_and_login(client, "notify-a@example.com")
    b = register_and_login(client, "notify-b@example.com")
    _enable(client, a)

    other = client.get("/users/me/notifications", headers=b).json()

    assert other["email_enabled"] is False
    assert other["telegram_chat_id"] is None
    assert other["email_address"] == "notify-b@example.com"


# --------------------------------------------------------------- delivery


def test_critical_alert_notifies_email_and_telegram(client, configured, sent, monkeypatch):
    monkeypatch.setattr(settings, "FRONTEND_URL", "https://app.example.com/")
    headers, device_id, key = _provision(client, "notify-send@example.com")
    _enable(client, headers)

    _ingest(client, key, HOT)

    assert [c[0] for c in sent] == ["email", "telegram"]
    _, to, subject, body = sent[0]
    assert to == "notify-send@example.com"
    assert subject == "[EdgeSphere] CRITICAL: Temperature alert on Pump Station 4"
    assert "Temperature exceeded 70°C" in body
    assert f"https://app.example.com/devices/{device_id}" in body
    assert sent[1][1] == "-100123"
    for call in sent:
        assert key not in str(call)
        assert key[:12] not in str(call)  # not even the key prefix


def test_cooldown_limits_notifications(client, configured, sent):
    headers, _, key = _provision(client, "notify-cooldown@example.com")
    _enable(client, headers, telegram_enabled=False)

    _ingest(client, key, HOT)
    _ingest(client, key, HOT)  # same alert type within ALERT_COOLDOWN_SECONDS: no alert, no message

    assert len(sent) == 1


def test_one_message_per_reading_with_all_alerts(client, configured, sent):
    headers, _, key = _provision(client, "notify-batch@example.com")
    _enable(client, headers, telegram_enabled=False)

    _ingest(client, key, {**HOT, "battery": 5, "cpu_usage": 99.0})

    assert len(sent) == 1
    _, _, subject, body = sent[0]
    assert subject == "[EdgeSphere] CRITICAL: 3 alerts on Pump Station 4"
    assert "TEMPERATURE" in body and "BATTERY" in body and "CPU" in body


def test_min_severity_critical_skips_high_alerts(client, configured, sent):
    headers, _, key = _provision(client, "notify-severity@example.com")
    _enable(client, headers, min_severity="CRITICAL")

    _ingest(client, key, LOW_BATTERY)

    assert sent == []


def test_nothing_sent_when_user_has_not_enabled(client, configured, sent):
    _, _, key = _provision(client, "notify-off@example.com")

    _ingest(client, key, HOT)

    assert sent == []


def test_nothing_sent_when_server_channels_are_removed(client, configured, sent, monkeypatch):
    headers, _, key = _provision(client, "notify-removed@example.com")
    _enable(client, headers)
    monkeypatch.setattr(settings, "SMTP_HOST", "")
    monkeypatch.setattr(settings, "TELEGRAM_BOT_TOKEN", "")

    _ingest(client, key, HOT)

    assert sent == []


def test_sender_failures_never_break_ingestion(client, configured, monkeypatch):
    def boom(*_args):
        raise ConnectionError("smtp://user:secret@smtp.example.com refused")

    delivered = []
    monkeypatch.setattr(email_sender, "send", boom)
    monkeypatch.setattr(telegram_sender, "send", lambda chat_id, text: delivered.append(chat_id))
    monkeypatch.setattr(dispatcher, "submit", dispatcher.deliver)
    headers, device_id, key = _provision(client, "notify-failure@example.com")
    _enable(client, headers)

    _ingest(client, key, HOT)

    assert delivered == ["-100123"]  # Telegram still sent after email failed
    assert len(client.get(f"/alerts/{device_id}", headers=headers).json()) == 1


def test_ingestion_does_not_wait_for_delivery(client, configured, monkeypatch):
    release = threading.Event()
    finished = threading.Event()

    def slow_send(*_args):
        release.wait(5)
        finished.set()

    monkeypatch.setattr(email_sender, "send", slow_send)
    headers, _, key = _provision(client, "notify-async@example.com")
    _enable(client, headers, telegram_enabled=False)

    started = time.monotonic()
    _ingest(client, key, HOT)
    elapsed = time.monotonic() - started

    assert not finished.is_set()  # delivery still pending after the response
    assert elapsed < 2
    release.set()
    assert finished.wait(5)


def test_queue_errors_are_swallowed(client, configured, monkeypatch):
    def broken_executor():
        raise RuntimeError("cannot schedule new futures after shutdown")

    monkeypatch.setattr(dispatcher, "_get_executor", broken_executor)
    headers, _, key = _provision(client, "notify-queue@example.com")
    _enable(client, headers)

    _ingest(client, key, HOT)


# ------------------------------------------------------------- test message


def test_test_notification_is_queued_and_rate_limited(client, configured, sent):
    headers = register_and_login(client, "notify-test@example.com")
    _enable(client, headers)

    first = client.post("/users/me/notifications/test", headers=headers)
    second = client.post("/users/me/notifications/test", headers=headers)

    assert first.status_code == 202
    assert first.json() == {"queued_channels": ["email", "telegram"]}
    assert [c[0] for c in sent] == ["email", "telegram"]
    assert second.status_code == 429


def test_test_notification_needs_an_enabled_channel(client, configured):
    headers = register_and_login(client, "notify-test-none@example.com")

    assert client.post("/users/me/notifications/test", headers=headers).status_code == 409
