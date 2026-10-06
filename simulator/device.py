import time
import requests

from simulator.sensor import Sensor
from simulator.config import SERVER, SEND_INTERVAL


class Device:

    def __init__(
        self,
        device_id: int,
        device_key: str
    ):
        self.device_id = device_id
        self.device_key = device_key

        self.sensor = Sensor()

    def run(self):

        while True:

            # -----------------------------
            # Generate sensor telemetry
            # -----------------------------
            payload = self.sensor.read()

            try:

                # -----------------------------
                # Send telemetry
                # -----------------------------
                response = requests.post(
                    f"{SERVER}/telemetry/",
                    json=payload,
                    headers={
                        "X-DEVICE-KEY": self.device_key
                    },
                    timeout=10
                )

                print(
                    f"Device {self.device_id} | "
                    f"Status: {response.status_code} | "
                    f"Telemetry: {payload}"
                )

                # -----------------------------
                # Print server error
                # -----------------------------
                if response.status_code != 200:

                    print(
                        f"Server response: {response.text}"
                    )

            except requests.exceptions.RequestException as e:

                print(
                    f"Device {self.device_id} | "
                    f"Connection error: {e}"
                )

            time.sleep(SEND_INTERVAL)