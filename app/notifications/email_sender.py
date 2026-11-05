import smtplib
import ssl
from email.message import EmailMessage

from app.core.config import settings

TIMEOUT_SECONDS = 10


def send(to: str, subject: str, body: str) -> None:
    """Send one plain-text email via the configured SMTP server. Raises on failure."""
    message = EmailMessage()
    message["From"] = settings.SMTP_FROM
    message["To"] = to
    message["Subject"] = subject
    message.set_content(body)

    context = ssl.create_default_context()
    if settings.SMTP_SSL:
        client = smtplib.SMTP_SSL(settings.SMTP_HOST, settings.SMTP_PORT, timeout=TIMEOUT_SECONDS, context=context)
    else:
        client = smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=TIMEOUT_SECONDS)

    with client:
        if not settings.SMTP_SSL and settings.SMTP_STARTTLS:
            client.starttls(context=context)
        if settings.SMTP_USERNAME:
            client.login(settings.SMTP_USERNAME, settings.SMTP_PASSWORD)
        client.send_message(message)
