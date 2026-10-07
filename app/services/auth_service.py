from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.repositories import user_repository
from app.schemas.user import UserRegister
from app.models.user import User
from app.core.security import (
    hash_password,
    verify_dummy_password,
    verify_password,
    create_access_token,
)


def register_user(
    user_data: UserRegister,
    db: Session
):
    existing_user = user_repository.get_user_by_email(
        user_data.email,
        db
    )

    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email already registered"
        )

    hashed_password = hash_password(
        user_data.password
    )

    new_user = User(
        email=user_data.email.lower(),
        hashed_password=hashed_password,
        full_name=user_data.full_name
    )

    return user_repository.create_user(
        new_user,
        db
    )


def login_user(
    username: str,
    password: str,
    db: Session
):
    invalid = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid email or password",
        headers={"WWW-Authenticate": "Bearer"},
    )

    user = user_repository.get_user_by_email(
        username,
        db
    )

    if not user:
        # Same work as a real check, so timing does not reveal accounts.
        verify_dummy_password(password)
        raise invalid

    if not verify_password(
        password,
        user.hashed_password
    ):
        raise invalid

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This account has been disabled",
        )

    access_token = create_access_token(
        {
            "sub": str(user.id)
        }
    )

    return {
        "access_token": access_token,
        "token_type": "bearer"
    }
