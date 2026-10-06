import threading

from simulator.device import Device
from simulator.config import NUMBER_OF_DEVICES


# --------------------------------------------------
# Device credentials
# --------------------------------------------------
# For now, put the real device keys generated
# by EdgeSphere here.
#
# Later we will move these into environment
# variables / secure storage.
# --------------------------------------------------

DEVICE_KEYS = {
    1: "PUT_DEVICE_1_KEY_HERE",
    2: "PUT_DEVICE_2_KEY_HERE",
    3: "PUT_DEVICE_3_KEY_HERE",
    4: "PUT_DEVICE_4_KEY_HERE",
    5: "PUT_DEVICE_5_KEY_HERE",
    6: "PUT_DEVICE_6_KEY_HERE",
    7: "PUT_DEVICE_7_KEY_HERE",
    8: "PUT_DEVICE_8_KEY_HERE",
    9: "PUT_DEVICE_9_KEY_HERE",
    10: "PUT_DEVICE_10_KEY_HERE",
}


# --------------------------------------------------
# Store running threads
# --------------------------------------------------

threads = []


# --------------------------------------------------
# Start simulated devices
# --------------------------------------------------

for device_id in range(1, NUMBER_OF_DEVICES + 1):

    device_key = DEVICE_KEYS.get(device_id)

    if not device_key:
        print(
            f"Device {device_id}: "
            f"No device key configured. Skipping."
        )
        continue

    device = Device(
        device_id=device_id,
        device_key=device_key
    )

    thread = threading.Thread(
        target=device.run,
        daemon=True
    )

    thread.start()

    threads.append(thread)

    print(
        f"Started simulated device {device_id}"
    )


# --------------------------------------------------
# Keep simulator running
# --------------------------------------------------

for thread in threads:
    thread.join()