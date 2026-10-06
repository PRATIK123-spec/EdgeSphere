from sqlalchemy import inspect

from app.models.device import Device


EXPECTED_DEVICE_COLUMNS = {
    "id",
    "display_name",
    "device_type",
    "manufacturer",
    "model",
    "serial_number",
    "device_key",
    "firmware_version",
    "status",
    "owner_id",
    "last_seen",
    "created_at",
}


def test_orm_device_schema_has_no_obsolete_name_column():
    column_names = set(Device.__table__.columns.keys())

    assert "name" not in column_names
    assert column_names == EXPECTED_DEVICE_COLUMNS


def test_sqlite_schema_matches_orm(db_session):
    inspector = inspect(db_session.bind)
    column_names = {column["name"] for column in inspector.get_columns("devices")}

    assert "name" not in column_names
    assert EXPECTED_DEVICE_COLUMNS.issubset(column_names)
