"""
Background delivery. Ingestion only queues a job and returns; a small thread
pool does the network I/O. Jobs carry plain values (never ORM objects, never
device keys) and never touch the database.
"""

import logging
import threading
from collections.abc import Callable
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass

from app.notifications import email_sender, telegram_sender

logger = logging.getLogger(__name__)

MAX_WORKERS = 2

_lock = threading.Lock()
_executor: ThreadPoolExecutor | None = None


@dataclass(frozen=True)
class Delivery:
    subject: str
    body: str
    email_to: str | None = None
    telegram_chat_id: str | None = None


def _get_executor() -> ThreadPoolExecutor:
    global _executor
    with _lock:
        if _executor is None:
            _executor = ThreadPoolExecutor(max_workers=MAX_WORKERS, thread_name_prefix="notify")
        return _executor


def shutdown() -> None:
    """Stop accepting jobs (app shutdown). A later submit starts a new pool."""
    global _executor
    with _lock:
        executor, _executor = _executor, None
    if executor is not None:
        executor.shutdown(wait=False, cancel_futures=True)


def _attempt(channel: str, send: Callable[[], None]) -> None:
    try:
        send()
    except Exception as exc:
        # Type only: messages can contain hosts, addresses or (for HTTP errors) URLs.
        logger.warning("Alert notification via %s failed (%s)", channel, type(exc).__name__)


def deliver(delivery: Delivery) -> None:
    """Send to every channel in the delivery; one failing channel never stops another."""
    if delivery.email_to:
        _attempt("email", lambda: email_sender.send(delivery.email_to, delivery.subject, delivery.body))
    if delivery.telegram_chat_id:
        _attempt(
            "telegram",
            lambda: telegram_sender.send(delivery.telegram_chat_id, f"{delivery.subject}\n\n{delivery.body}"),
        )


def submit(delivery: Delivery) -> None:
    """Queue a delivery without waiting for it. Never raises."""
    try:
        _get_executor().submit(deliver, delivery)
    except Exception as exc:
        logger.warning("Could not queue alert notification (%s)", type(exc).__name__)
