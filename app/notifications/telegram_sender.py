import httpx

from app.core.config import settings

TIMEOUT_SECONDS = 10


class TelegramError(Exception):
    """Telegram rejected the message. The text never includes the bot token."""


def send(chat_id: str, text: str) -> None:
    """Send a plain-text message (no parse mode, so device names cannot inject markup)."""
    response = httpx.post(
        f"https://api.telegram.org/bot{settings.TELEGRAM_BOT_TOKEN}/sendMessage",
        json={"chat_id": chat_id, "text": text, "disable_web_page_preview": True},
        timeout=TIMEOUT_SECONDS,
    )
    if response.status_code != 200:
        raise TelegramError(f"Telegram API returned HTTP {response.status_code}")
