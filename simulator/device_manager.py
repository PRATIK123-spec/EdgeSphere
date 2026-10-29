"""Run one virtual device per key in EDGESPHERE_DEVICE_KEYS (see simulator/config.py).

    EDGESPHERE_DEVICE_KEYS="edg_…,edg_…" python -m simulator.device_manager
"""

import sys
import threading

from simulator.config import ConfigError, load_settings
from simulator.device import Device


def main() -> int:
    try:
        settings = load_settings()
    except ConfigError as error:
        print(f"Configuration error: {error}")
        return 2

    if not settings.device_keys:
        print(
            "No device keys configured.\n"
            "Register a device in the EdgeSphere UI, copy its key, then run:\n"
            '  EDGESPHERE_DEVICE_KEYS="<key1>,<key2>" python -m simulator.device_manager'
        )
        return 1

    temp = f"{settings.start_temp} °C" if settings.start_temp is not None else "normal (28–34 °C)"
    print(
        f"Simulating {len(settings.device_keys)} device(s) -> {settings.server} "
        f"every {settings.interval:g}s, start temperature {temp}"
    )

    threads = []
    for device_id, device_key in enumerate(settings.device_keys, start=1):
        device = Device(
            device_id=device_id,
            device_key=device_key,
            server=settings.server,
            interval=settings.interval,
            start_temp=settings.start_temp,
        )
        thread = threading.Thread(target=device.run, daemon=True)
        thread.start()
        threads.append(thread)
        print(f"Started simulated device {device_id}")

    try:
        for thread in threads:
            thread.join()
    except KeyboardInterrupt:
        print("\nStopping simulator.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
