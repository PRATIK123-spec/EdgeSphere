from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.alert import Alert


def create_alert(alert: Alert, db: Session):
    db.add(alert)
    db.commit()
    db.refresh(alert)
    return alert


def get_alert(alert_id: int, db: Session):
    return db.get(Alert, alert_id)


def get_latest_by_type(
    device_id: int,
    alert_type: str,
    db: Session
):
    statement = (
        select(Alert)
        .where(
            Alert.device_id == device_id,
            Alert.alert_type == alert_type,
        )
        .order_by(Alert.created_at.desc())
        .limit(1)
    )

    return db.execute(statement).scalar_one_or_none()


def get_alerts(device_id: int, db: Session):
    statement = (
        select(Alert)
        .where(Alert.device_id == device_id)
        .order_by(Alert.created_at.desc())
    )

    return db.execute(statement).scalars().all()


def delete_alert(alert: Alert, db: Session):
    db.delete(alert)
    db.commit()
