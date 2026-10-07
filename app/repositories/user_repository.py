from sqlalchemy.orm import Session
from sqlalchemy import func, select

from app.models.user import User


def get_user_by_email(
    email: str,
    db: Session
):
    # Case-insensitive (backed by the unique index on lower(email)).
    statement = select(User).where(
        func.lower(User.email) == email.strip().lower()
    )

    result = db.execute(statement)

    return result.scalar_one_or_none()

def get_user_by_id(
    user_id: int,
    db: Session
):
    statement = select(User).where(
        User.id == user_id
    )

    result = db.execute(statement)

    return result.scalar_one_or_none()


def create_user(
    user: User,
    db: Session
):
    db.add(user)
    db.commit()
    db.refresh(user)

    return user