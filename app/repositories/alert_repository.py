from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.alert import Alert


def create_alert(alert: Alert, db: Session):
    db.add(alert)
    db.commit()
    db.refresh(alert)
    return alert


def get_alerts(device_id: int, db: Session):
    statement = (
        select(Alert)
        .where(Alert.device_id == device_id)
        .order_by(Alert.created_at.desc())
    )

    return db.execute(statement).scalars().all()


def delete_alert(alert_id: int, db: Session):
    alert = db.get(Alert, alert_id)

    if alert is None:
        return None

    db.delete(alert)
    db.commit()

    return alert