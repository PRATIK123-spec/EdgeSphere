from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, StringConstraints, model_validator

# A numeric chat id (negative for groups) or a public @channel username.
TelegramChatId = Annotated[
    str,
    StringConstraints(strip_whitespace=True, pattern=r"^(-?\d{1,20}|@[A-Za-z][A-Za-z0-9_]{4,31})$"),
]

Severity = Literal["HIGH", "CRITICAL"]


class NotificationSettingsUpdate(BaseModel):
    """Body for PUT /users/me/notifications (replaces all settings)."""

    model_config = ConfigDict(extra="forbid")

    email_enabled: bool = False
    telegram_enabled: bool = False
    telegram_chat_id: TelegramChatId | None = None
    # Lowest severity that notifies: HIGH = HIGH and CRITICAL; CRITICAL = critical only.
    min_severity: Severity = "HIGH"

    @model_validator(mode="after")
    def _chat_id_required_for_telegram(self):
        if self.telegram_enabled and not self.telegram_chat_id:
            raise ValueError("telegram_chat_id is required to enable Telegram notifications")
        return self


class NotificationSettingsResponse(BaseModel):
    email_enabled: bool
    telegram_enabled: bool
    telegram_chat_id: str | None
    min_severity: Severity
    # Where email notifications go (always the account's own address).
    email_address: str
    # Whether the server has each channel configured (SMTP_* / TELEGRAM_BOT_TOKEN).
    email_available: bool
    telegram_available: bool


class NotificationTestResponse(BaseModel):
    queued_channels: list[str]
