import random


class Sensor:

    def __init__(self):

        self.temperature = random.uniform(28, 34)

        self.battery = 100

        self.cpu = random.randint(20, 40)

        self.ram = random.randint(20, 45)

    def read(self):

        self.temperature += random.uniform(-1, 1)

        self.battery -= random.uniform(0.02, 0.15)

        self.cpu += random.randint(-3, 3)

        self.ram += random.randint(-3, 3)

        self.cpu = max(0, min(100, self.cpu))
        self.ram = max(0, min(100, self.ram))
        self.battery = max(0, self.battery)

        return {
            "temperature": round(self.temperature, 2),
    "battery": int(self.battery),
    "cpu_usage": float(self.cpu),
    "ram_usage": float(self.ram)
        }