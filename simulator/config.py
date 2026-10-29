"""Simulator settings, read from environment variables.

EDGESPHERE_SERVER       API base URL (default http://127.0.0.1:8000)
EDGESPHERE_DEVICE_KEYS  comma-separated device keys, one virtual device per key (required)
EDGESPHERE_INTERVAL     seconds between readings per device (default 5)
EDGESPHERE_START_TEMP   optional starting temperature in °C, e.g. 75 to trigger
                        temperature alerts (default: a normal 28–34 °C)

Device keys are secrets: they are never printed or included in repr().
"""

import os
from collections.abc import Mapping
from dataclasses import dataclass, field

DEFAULT_SERVER = "http://127.0.0.1:8000"
DEFAULT_INTERVAL = 5.0


class ConfigError(ValueError):
    """Invalid simulator configuration (message never contains a key)."""


@dataclass(frozen=True)
class Settings:
    server: str
    interval: float
    start_temp: float | None
    device_keys: list[str] = field(repr=False)


def load_settings(env: Mapping[str, str] = os.environ) -> Settings:
    server = (env.get("EDGESPHERE_SERVER") or DEFAULT_SERVER).strip().rstrip("/")
    if not server.startswith(("http://", "https://")):
        raise ConfigError("EDGESPHERE_SERVER must start with http:// or https://")

    raw_interval = (env.get("EDGESPHERE_INTERVAL") or "").strip()
    try:
        interval = float(raw_interval) if raw_interval else DEFAULT_INTERVAL
    except ValueError:
        raise ConfigError("EDGESPHERE_INTERVAL must be a number of seconds") from None
    if interval <= 0:
        raise ConfigError("EDGESPHERE_INTERVAL must be greater than 0")

    raw_temp = (env.get("EDGESPHERE_START_TEMP") or "").strip()
    try:
        start_temp = float(raw_temp) if raw_temp else None
    except ValueError:
        raise ConfigError("EDGESPHERE_START_TEMP must be a number (°C)") from None
    # Matches the API's accepted range for temperature readings.
    if start_temp is not None and not -100 <= start_temp <= 250:
        raise ConfigError("EDGESPHERE_START_TEMP must be between -100 and 250")

    keys = [k.strip() for k in (env.get("EDGESPHERE_DEVICE_KEYS") or "").split(",") if k.strip()]

    return Settings(server=server, interval=interval, start_temp=start_temp, device_keys=keys)
