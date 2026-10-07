from collections.abc import Callable
from contextlib import AbstractContextManager

from app.database.connection import SessionLocal

from sqlalchemy.orm import Session

SessionFactory = Callable[[], AbstractContextManager[Session]]


def get_db():

    db = SessionLocal()

    try:

        yield db

    finally:

        db.close()


def get_session_factory() -> SessionFactory:
    """
    For long-lived handlers (WebSockets): returns a factory of short-lived
    sessions (`with factory() as db: ...`) instead of one session held open
    for the whole connection.
    """
    return SessionLocal
