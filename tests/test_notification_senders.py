import httpx
import pytest

from app.core.config import settings
from app.notifications import email_sender, telegram_sender


class FakeSMTP:
    instances: list["FakeSMTP"] = []

    def __init__(self, host, port, timeout=None, context=None):
        self.host, self.port, self.timeout = host, port, timeout
        self.calls = []
        FakeSMTP.instances.append(self)

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        self.calls.append("quit")

    def starttls(self, context=None):
        self.calls.append("starttls")

    def login(self, user, password):
        self.calls.append(("login", user))

    def send_message(self, message):
        self.calls.append(("send", message["To"], message["Subject"], message.get_content()))


@pytest.fixture
def smtp(monkeypatch):
    FakeSMTP.instances = []
    monkeypatch.setattr(email_sender.smtplib, "SMTP", FakeSMTP)
    monkeypatch.setattr(email_sender.smtplib, "SMTP_SSL", FakeSMTP)
    monkeypatch.setattr(settings, "SMTP_HOST", "smtp.example.com")
    monkeypatch.setattr(settings, "SMTP_PORT", 587)
    monkeypatch.setattr(settings, "SMTP_FROM", "alerts@example.com")
    monkeypatch.setattr(settings, "SMTP_USERNAME", "mailer")
    monkeypatch.setattr(settings, "SMTP_PASSWORD", "pw")
    monkeypatch.setattr(settings, "SMTP_STARTTLS", True)
    monkeypatch.setattr(settings, "SMTP_SSL", False)
    return FakeSMTP


def test_email_uses_starttls_login_and_timeout(smtp):
    email_sender.send("ops@example.com", "Subject", "Body")

    (client,) = smtp.instances
    assert (client.host, client.port, client.timeout) == ("smtp.example.com", 587, email_sender.TIMEOUT_SECONDS)
    assert client.calls[0] == "starttls"
    assert client.calls[1] == ("login", "mailer")
    assert client.calls[2][:3] == ("send", "ops@example.com", "Subject")
    assert client.calls[2][3].strip() == "Body"


def test_email_without_credentials_skips_login(smtp, monkeypatch):
    monkeypatch.setattr(settings, "SMTP_USERNAME", "")

    email_sender.send("ops@example.com", "Subject", "Body")

    assert not any(isinstance(c, tuple) and c[0] == "login" for c in smtp.instances[0].calls)


def test_email_implicit_tls_skips_starttls(smtp, monkeypatch):
    monkeypatch.setattr(settings, "SMTP_SSL", True)

    email_sender.send("ops@example.com", "Subject", "Body")

    assert "starttls" not in smtp.instances[0].calls


def test_telegram_posts_plain_text(monkeypatch):
    captured = {}

    def fake_post(url, json, timeout):
        captured.update(url=url, json=json, timeout=timeout)
        return httpx.Response(200, json={"ok": True})

    monkeypatch.setattr(settings, "TELEGRAM_BOT_TOKEN", "123:abc")
    monkeypatch.setattr(telegram_sender.httpx, "post", fake_post)

    telegram_sender.send("-100", "hello")

    assert captured["url"] == "https://api.telegram.org/bot123:abc/sendMessage"
    assert captured["json"] == {"chat_id": "-100", "text": "hello", "disable_web_page_preview": True}
    assert "parse_mode" not in captured["json"]
    assert captured["timeout"] == telegram_sender.TIMEOUT_SECONDS


def test_telegram_error_never_contains_the_token(monkeypatch):
    monkeypatch.setattr(settings, "TELEGRAM_BOT_TOKEN", "123:secret-token")
    monkeypatch.setattr(telegram_sender.httpx, "post", lambda *a, **k: httpx.Response(401, json={"ok": False}))

    with pytest.raises(telegram_sender.TelegramError) as excinfo:
        telegram_sender.send("-100", "hello")

    assert "secret-token" not in str(excinfo.value)
