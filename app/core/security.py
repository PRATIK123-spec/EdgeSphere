from datetime import datetime, timedelta, timezone

import jwt
from pwdlib import PasswordHash
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from app.core.config import settings
from app.database.dependencies import get_db
from app.models.user import User
from app.repositories import user_repository

password_hash = PasswordHash.recommended()

oauth2_scheme = OAuth2PasswordBearer(
    tokenUrl="/auth/login"
)

# Verified against when the email is unknown, so login takes the same time
# whether or not an account exists (no user enumeration via timing).
_DUMMY_PASSWORD_HASH = password_hash.hash("edgesphere-timing-equalizer")


def credentials_exception(detail: str = "Could not validate credentials") -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail=detail,
        headers={"WWW-Authenticate": "Bearer"},
    )


def hash_password(password: str) -> str:
    return password_hash.hash(password)


def verify_password(
    plain_password: str,
    hashed_password: str
) -> bool:
    return password_hash.verify(
        plain_password,
        hashed_password
    )


def verify_dummy_password(plain_password: str) -> None:
    password_hash.verify(plain_password, _DUMMY_PASSWORD_HASH)


def create_access_token(data: dict) -> str:
    to_encode = data.copy()

    now = datetime.now(timezone.utc)
    expire = now + timedelta(
        minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES
    )

    to_encode["iat"] = now
    to_encode["exp"] = expire

    encoded_jwt = jwt.encode(
        to_encode,
        settings.SECRET_KEY,
        algorithm=settings.JWT_ALGORITHM
    )

    return encoded_jwt


def decode_access_token(token: str) -> dict:
    """Validate signature, algorithm and expiry; `sub` and `exp` are required."""
    try:
        return jwt.decode(
            token,
            settings.SECRET_KEY,
            algorithms=[settings.JWT_ALGORITHM],
            options={"require": ["exp", "sub"]},
        )

    except jwt.ExpiredSignatureError:
        raise credentials_exception("Token has expired")

    except jwt.InvalidTokenError:
        raise credentials_exception()


def authenticate_access_token(token: str, db: Session) -> tuple[User, int]:
    """
    Resolve a JWT to an active user. Returns (user, expiry epoch seconds).
    Raises 401 for malformed, expired or unknown tokens and inactive users.
    Shared by the HTTP dependency and the WebSocket handshake.
    """
    payload = decode_access_token(token)

    subject = payload.get("sub")
    if not isinstance(subject, str) or not subject.isdigit():
        raise credentials_exception()

    user = user_repository.get_user_by_id(int(subject), db)

    if user is None or not user.is_active:
        raise credentials_exception()

    return user, int(payload["exp"])


def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db)
) -> User:
    user, _ = authenticate_access_token(token, db)
    return user


def admin_required(
    current_user: User = Depends(get_current_user)
):
    if not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to perform this action."
        )

    return current_user
