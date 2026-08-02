import time
import requests

from simulator.sensor import Sensor
from simulator.config import SERVER, TELEMETRY_ENDPOINT, SEND_INTERVAL


class Device:

    def __init__(self, device_id):

        self.device_id = device_id

        self.sensor = Sensor()

    def run(self):

        while True:

            payload = self.sensor.read()

            payload["device_id"] = self.device_id

            try:

                response = requests.post(
    f"{SERVER}{TELEMETRY_ENDPOINT}/{self.device_id}",
    json=payload
)

                print(
                    f"Device {self.device_id}",
                    response.status_code,
                    payload
                )

            except Exception as e:

                print(e)

            time.sleep(SEND_INTERVAL)