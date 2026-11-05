from sqlalchemy import text
from sqlalchemy.orm import Session


def ping(db: Session) -> None:
    """Round-trip to the database; raises if it cannot be reached."""
    db.execute(text("SELECT 1"))
