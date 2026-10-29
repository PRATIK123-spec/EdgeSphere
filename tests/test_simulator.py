import random

import pytest

from simulator import device as device_module
from simulator import device_manager
from simulator.config import DEFAULT_INTERVAL, DEFAULT_SERVER, ConfigError, load_settings
from simulator.device import Device
from simulator.sensor import Sensor

KEY_A = "edg_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
KEY_B = "edg_bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"


def test_defaults_without_environment():
    settings = load_settings({})
    assert settings.server == DEFAULT_SERVER
    assert settings.interval == DEFAULT_INTERVAL
    assert settings.start_temp is None
    assert settings.device_keys == []


def test_reads_all_variables_and_splits_keys():
    settings = load_settings(
        {
            "EDGESPHERE_SERVER": "https://edgesphere-api.onrender.com/",
            "EDGESPHERE_DEVICE_KEYS": f" {KEY_A} ,, {KEY_B},",
            "EDGESPHERE_INTERVAL": "2.5",
            "EDGESPHERE_START_TEMP": "75",
        }
    )
    assert settings.server == "https://edgesphere-api.onrender.com"
    assert settings.device_keys == [KEY_A, KEY_B]
    assert settings.interval == 2.5
    assert settings.start_temp == 75.0


@pytest.mark.parametrize(
    "env",
    [
        {"EDGESPHERE_INTERVAL": "0"},
        {"EDGESPHERE_INTERVAL": "fast"},
        {"EDGESPHERE_START_TEMP": "hot"},
        {"EDGESPHERE_START_TEMP": "300"},
        {"EDGESPHERE_SERVER": "edgesphere-api.onrender.com"},
    ],
)
def test_invalid_values_are_rejected(env):
    with pytest.raises(ConfigError):
        load_settings({**env, "EDGESPHERE_DEVICE_KEYS": KEY_A})


def test_keys_never_appear_in_repr_or_errors():
    settings = load_settings({"EDGESPHERE_DEVICE_KEYS": KEY_A})
    assert KEY_A not in repr(settings)
    with pytest.raises(ConfigError) as excinfo:
        load_settings({"EDGESPHERE_DEVICE_KEYS": KEY_A, "EDGESPHERE_INTERVAL": "-1"})
    assert KEY_A not in str(excinfo.value)


def test_start_temp_keeps_readings_near_baseline():
    random.seed(1234)
    sensor = Sensor(start_temp=75)
    temperatures = [sensor.read()["temperature"] for _ in range(300)]
    assert min(temperatures) > 65  # stays well above the 70 °C alert line on average
    assert sum(t > 70 for t in temperatures) > 270


def test_default_sensor_stays_in_normal_range():
    random.seed(99)
    sensor = Sensor()
    temperatures = [sensor.read()["temperature"] for _ in range(300)]
    assert max(temperatures) < 45


class _StopLoop(Exception):
    pass


class _Response:
    def __init__(self, status_code, text=""):
        self.status_code = status_code
        self.text = text


@pytest.mark.parametrize(
    "status, body",
    [
        (200, "{}"),
        (401, '{"detail":"Invalid device key"}'),
        (422, f'{{"detail":"bad request for key {KEY_A}"}}'),  # hypothetical echo: must be redacted
    ],
)
def test_device_never_prints_its_key(monkeypatch, capsys, status, body):
    sent = {}

    def fake_post(url, json, headers, timeout):
        sent.update(url=url, headers=headers)
        return _Response(status, body)

    monkeypatch.setattr(device_module.requests, "post", fake_post)
    monkeypatch.setattr(device_module.time, "sleep", lambda s: (_ for _ in ()).throw(_StopLoop()))

    device = Device(device_id=1, device_key=KEY_A, server="http://api.test", interval=5)
    with pytest.raises(_StopLoop):
        device.run()

    out = capsys.readouterr().out
    assert sent == {"url": "http://api.test/telemetry/", "headers": {"X-DEVICE-KEY": KEY_A}}
    assert KEY_A not in out
    assert f"Status: {status}" in out


def test_manager_exits_with_instructions_when_no_keys(monkeypatch, capsys):
    monkeypatch.setattr(device_manager, "load_settings", lambda: load_settings({}))
    assert device_manager.main() == 1
    assert "EDGESPHERE_DEVICE_KEYS" in capsys.readouterr().out
