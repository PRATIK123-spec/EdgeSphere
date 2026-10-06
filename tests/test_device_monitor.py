from datetime import timedelta

from app.core.security import hash_password
from app.models.device import Device
from app.models.user import User
from app.repositories import device_repository
from app.utils.device_identity import generate_device_key, generate_serial_number
from app.utils.time import utc_now


def test_stale_online_device_is_marked_offline(db_session):
    user = User(
        email="monitor@example.com",
        hashed_password=hash_password("secret123"),
        full_name="Monitor User",
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)

    device = Device(
        display_name="Stale Sensor",
        device_type="ESP32",
        manufacturer="Espressif",
        model="WROOM",
        serial_number=generate_serial_number(),
        device_key=generate_device_key(),
        firmware_version="1.0.0",
        status="Online",
        owner_id=user.id,
        last_seen=utc_now() - timedelta(seconds=120),
    )
    db_session.add(device)
    db_session.commit()
    db_session.refresh(device)

    updated = device_repository.mark_stale_online_devices_offline(
        db_session,
        offline_after_seconds=60,
    )

    db_session.refresh(device)

    assert updated == 1
    assert device.status == "Offline"


def test_recent_online_device_stays_online(db_session):
    user = User(
        email="fresh-monitor@example.com",
        hashed_password=hash_password("secret123"),
        full_name="Monitor User",
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)

    device = Device(
        display_name="Fresh Sensor",
        device_type="ESP32",
        manufacturer="Espressif",
        model="WROOM",
        serial_number=generate_serial_number(),
        device_key=generate_device_key(),
        firmware_version="1.0.0",
        status="Online",
        owner_id=user.id,
        last_seen=utc_now(),
    )
    db_session.add(device)
    db_session.commit()
    db_session.refresh(device)

    updated = device_repository.mark_stale_online_devices_offline(
        db_session,
        offline_after_seconds=60,
    )

    db_session.refresh(device)

    assert updated == 0
    assert device.status == "Online"
