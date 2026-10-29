import time
import requests

from simulator.sensor import Sensor


class Device:
    """One virtual device. The key is only ever sent in the X-DEVICE-KEY header, never printed."""

    def __init__(
        self,
        device_id: int,
        device_key: str,
        server: str,
        interval: float,
        start_temp: float | None = None,
    ):
        self.device_id = device_id
        self._device_key = device_key
        self.url = f"{server}/telemetry/"
        self.interval = interval

        self.sensor = Sensor(start_temp)

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
                    self.url,
                    json=payload,
                    headers={
                        "X-DEVICE-KEY": self._device_key
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
                if response.status_code == 401:
                    print(
                        f"Device {self.device_id} | Key rejected: "
                        "check EDGESPHERE_DEVICE_KEYS (rotate the key in the UI if it was lost)"
                    )
                elif response.status_code in (502, 503, 504):
                    print(f"Device {self.device_id} | Server is starting up, retrying")
                elif response.status_code != 200:
                    # Redact before truncating, in case an error body ever echoes the key.
                    text = response.text.replace(self._device_key, "[redacted]")
                    print(f"Server response: {text[:200]}")

            except requests.exceptions.RequestException as e:

                print(
                    f"Device {self.device_id} | "
                    f"Connection error: {type(e).__name__}"
                )

            time.sleep(self.interval)
