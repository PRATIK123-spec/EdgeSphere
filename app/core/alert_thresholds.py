"""
Alert thresholds. A device may override any of them; NULL columns fall back
to these defaults, which are the original fleet-wide rules.
"""

from __future__ import annotations

from dataclasses import asdict, dataclass
from typing import Any


@dataclass(frozen=True)
class AlertThresholds:
    temperature_max: float = 70.0  # °C; alert when above (CRITICAL)
    battery_min: float = 20.0  # %; alert when below (HIGH)
    cpu_max: float = 90.0  # %; alert when above (HIGH)
    ram_max: float = 90.0  # %; alert when above (HIGH)

    def as_dict(self) -> dict[str, float]:
        return asdict(self)


DEFAULT_THRESHOLDS = AlertThresholds()

# Threshold name -> nullable Device column holding the per-device override.
DEVICE_COLUMNS: dict[str, str] = {
    "temperature_max": "alert_temperature_max",
    "battery_min": "alert_battery_min",
    "cpu_max": "alert_cpu_max",
    "ram_max": "alert_ram_max",
}

# Accepted ranges, matching the telemetry bounds (and the CHECK constraints).
LIMITS: dict[str, tuple[float, float]] = {
    "temperature_max": (-100.0, 250.0),
    "battery_min": (0.0, 100.0),
    "cpu_max": (0.0, 100.0),
    "ram_max": (0.0, 100.0),
}


def device_overrides(device: Any) -> dict[str, float | None]:
    """The device's own values; None = uses the default."""
    return {name: getattr(device, column) for name, column in DEVICE_COLUMNS.items()}


def effective_thresholds(device: Any) -> AlertThresholds:
    defaults = DEFAULT_THRESHOLDS.as_dict()
    return AlertThresholds(
        **{name: (value if value is not None else defaults[name]) for name, value in device_overrides(device).items()}
    )
