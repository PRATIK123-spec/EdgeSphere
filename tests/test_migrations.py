"""
Alembic migration tests against real PostgreSQL.

Skipped unless EDGESPHERE_MIGRATION_TEST_PG_URL points at a PostgreSQL
server URL whose role may CREATE/DROP databases, e.g.
    postgresql+psycopg://user:pass@localhost:5432/postgres
Each test creates and drops its own uniquely named throwaway database.
It never touches DATABASE_URL's database.
"""

import hashlib
import os
import subprocess
import sys
import uuid
from contextlib import contextmanager
from pathlib import Path

import pytest
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.engine import make_url

ADMIN_URL = os.environ.get("EDGESPHERE_MIGRATION_TEST_PG_URL")
ROOT = Path(__file__).resolve().parents[1]

pytestmark = pytest.mark.skipif(not ADMIN_URL, reason="EDGESPHERE_MIGRATION_TEST_PG_URL not set")

HEAD = "0006_alert_lifecycle"


@contextmanager
def throwaway_database():
    name = f"edgesphere_migtest_{uuid.uuid4().hex[:10]}"
    admin = create_engine(ADMIN_URL, isolation_level="AUTOCOMMIT")
    with admin.connect() as c:
        c.execute(text(f'CREATE DATABASE "{name}"'))
    url = make_url(ADMIN_URL).set(database=name).render_as_string(hide_password=False)
    try:
        yield url
    finally:
        with admin.connect() as c:
            c.execute(text(f'DROP DATABASE IF EXISTS "{name}" WITH (FORCE)'))
        admin.dispose()


def alembic(url: str, *args: str) -> str:
    env = {**os.environ, "DATABASE_URL": url, "PYTHONDONTWRITEBYTECODE": "1"}
    # The project's own alembic/ folder shadows the package for `python -m alembic`,
    # so use the console script installed next to the interpreter.
    result = subprocess.run(
        [str(Path(sys.executable).parent / "alembic"), *args], cwd=ROOT, env=env, capture_output=True, text=True
    )
    assert result.returncode == 0, result.stdout[-2000:] + result.stderr[-2000:]
    return result.stdout + result.stderr


def version(url: str) -> str:
    engine = create_engine(url)
    with engine.connect() as c:
        value = c.execute(text("SELECT version_num FROM alembic_version")).scalar_one()
    engine.dispose()
    return value


def test_fresh_database_upgrades_to_head_and_matches_models():
    with throwaway_database() as url:
        alembic(url, "upgrade", "head")
        assert version(url) == HEAD
        alembic(url, "check")  # ORM models and migrated schema agree

        engine = create_engine(url)
        insp = inspect(engine)
        indexes = {ix["name"] for t in ("telemetry", "alerts", "devices", "users") for ix in insp.get_indexes(t)}
        assert {
            "ix_telemetry_device_id_created_at", "ix_alerts_device_id_created_at",
            "ix_alerts_device_id_severity", "ix_alerts_device_id_status",
            "ix_devices_owner_id", "ix_devices_last_seen", "uq_users_email_lower",
        } <= indexes
        assert "device_key" not in {c["name"] for c in insp.get_columns("devices")}
        assert {fk["options"].get("ondelete") for fk in insp.get_foreign_keys("telemetry")} == {"CASCADE"}
        engine.dispose()


def test_existing_database_upgrade_preserves_and_repairs_data():
    with throwaway_database() as url:
        alembic(url, "upgrade", "0002_create_missing_tables")  # the pre-hardening schema

        legacy_key = "edg_" + "ab" * 16  # 36-char key format used by early devices
        engine = create_engine(url)
        with engine.begin() as c:
            c.execute(text(
                "INSERT INTO users (id, email, hashed_password, full_name, is_active, is_admin, created_at) "
                "VALUES (1, 'a@example.com', 'x', 'A', true, false, '2026-01-01')"))
            c.execute(text(
                "INSERT INTO devices (id, display_name, device_type, manufacturer, model, serial_number, device_key, "
                "firmware_version, status, owner_id, last_seen, created_at) VALUES "
                "(1, 'Reporting', 't', 'm', 'x', 'S1', :k1, '1.0.0', 'Online', 1, '2026-01-01', '2026-01-01'), "
                "(2, 'Silent', 't', 'm', 'x', 'S2', :k2, '1.0.0', 'Offline', 1, '2026-01-01', '2026-01-01')"),
                {"k1": legacy_key, "k2": "edg_" + "cd" * 32})
            c.execute(text(
                "INSERT INTO telemetry (device_id, temperature, battery, cpu_usage, ram_usage, created_at) VALUES "
                "(1, 30, 90, 10, 10, '2026-01-02 10:00'), (1, 31, 89, 11, 11, '2026-01-03 12:30')"))
            c.execute(text(
                "INSERT INTO alerts (device_id, alert_type, message, severity, created_at) "
                "VALUES (1, 'CPU', 'CPU usage above 90%', 'HIGH', '2026-01-02 10:00')"))
        engine.dispose()

        alembic(url, "upgrade", "head")
        assert version(url) == HEAD
        alembic(url, "check")

        engine = create_engine(url)
        with engine.connect() as c:
            assert c.execute(text("SELECT count(*) FROM telemetry")).scalar_one() == 2
            devices = {row.id: row for row in c.execute(text("SELECT * FROM devices")).all()}
            # Keys hashed in place: the device's existing key still authenticates.
            assert devices[1].key_hash == hashlib.sha256(legacy_key.encode()).hexdigest()
            assert devices[1].key_prefix == "edg_abababab"
            # last_seen repaired from real telemetry; never-reporting device -> NULL.
            assert str(devices[1].last_seen) == "2026-01-03 12:30:00"
            assert devices[2].last_seen is None and devices[2].status == "Offline"
            alert = c.execute(text("SELECT status, telemetry_id FROM alerts")).one()
            assert alert.status == "active" and alert.telemetry_id is None
            assert c.execute(text("SELECT bool_and(alerts_evaluated) FROM telemetry")).scalar_one() is True
        engine.dispose()


def test_downgrade_and_reupgrade_round_trip():
    with throwaway_database() as url:
        alembic(url, "upgrade", "head")
        alembic(url, "downgrade", "0002_create_missing_tables")
        assert version(url) == "0002_create_missing_tables"
        alembic(url, "upgrade", "head")
        assert version(url) == HEAD


def test_migration_chain_is_linear():
    out = alembic("postgresql+psycopg://unused@localhost/unused", "heads")
    heads = [line for line in out.splitlines() if "(head)" in line]
    assert len(heads) == 1 and HEAD in heads[0]
