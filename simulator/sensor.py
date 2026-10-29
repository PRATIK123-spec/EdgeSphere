import random


class Sensor:

    def __init__(self, start_temp: float | None = None):

        # Readings wander around this baseline instead of drifting away for good.
        self.baseline = start_temp if start_temp is not None else random.uniform(28, 34)

        self.temperature = self.baseline + random.uniform(-0.5, 0.5)

        self.battery = 100

        self.cpu = random.randint(20, 40)

        self.ram = random.randint(20, 45)

    def read(self):

        self.temperature += random.uniform(-1, 1) + 0.1 * (self.baseline - self.temperature)

        self.battery -= random.uniform(0.02, 0.15)

        self.cpu += random.randint(-3, 3)

        self.ram += random.randint(-3, 3)

        self.cpu = max(0, min(100, self.cpu))
        self.ram = max(0, min(100, self.ram))
        self.battery = max(0, self.battery)
        # Stay inside the API's accepted range.
        self.temperature = max(-100, min(250, self.temperature))

        return {
            "temperature": round(self.temperature, 2),
            "battery": int(self.battery),
            "cpu_usage": float(self.cpu),
            "ram_usage": float(self.ram),
        }
