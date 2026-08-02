from sqlalchemy.orm import Session
from sqlalchemy import select

from app.models.user import User


def get_user_by_email(
    email: str,
    db: Session
):
    statement = select(User).where(
        User.email == email
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