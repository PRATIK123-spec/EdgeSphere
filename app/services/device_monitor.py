import asyncio
import logging

from app.core.config import settings
from app.database.connection import SessionLocal
from app.repositories import device_repository

logger = logging.getLogger(__name__)


def mark_offline_devices() -> int:
    db = SessionLocal()
    try:
        return device_repository.mark_stale_online_devices_offline(
            db,
            settings.DEVICE_OFFLINE_AFTER_SECONDS,
        )
    except Exception:
        logger.exception("Device monitor failed to mark stale devices offline")
        db.rollback()
        return 0
    finally:
        db.close()


async def run_device_monitor(stop: asyncio.Event) -> None:
    while not stop.is_set():
        await asyncio.to_thread(mark_offline_devices)

        try:
            await asyncio.wait_for(
                stop.wait(),
                timeout=settings.DEVICE_MONITOR_INTERVAL_SECONDS,
            )
        except TimeoutError:
            continue
