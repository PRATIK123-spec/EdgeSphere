import threading

from simulator.device import Device
from simulator.config import NUMBER_OF_DEVICES


threads = []


for i in range(1, NUMBER_OF_DEVICES + 1):

    device = Device(i)

    thread = threading.Thread(
        target=device.run,
        daemon=True
    )

    thread.start()

    threads.append(thread)


for thread in threads:

    thread.join()