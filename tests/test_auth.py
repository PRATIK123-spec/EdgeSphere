import jwt

from app.core.config import settings
from app.models.user import User
from tests.conftest import register_and_login
from tests.helpers import make_token, user_id_of

REGISTER = {"email": "ada@example.com", "password": "secret123", "full_name": "Ada Lovelace"}


def test_register_returns_user_without_password(client):
    response = client.post("/auth/register", json=REGISTER)
    assert response.status_code == 201
    body = response.json()
    assert body["email"] == "ada@example.com"
    assert body["is_active"] is True
    assert "password" not in body and "hashed_password" not in body


def test_register_duplicate_email_is_case_insensitive(client):
    assert client.post("/auth/register", json=REGISTER).status_code == 201
    again = client.post("/auth/register", json={**REGISTER, "email": "ADA@Example.com"})
    assert again.status_code == 409


def test_register_validation(client):
    cases = [
        {**REGISTER, "password": "short"},
        {**REGISTER, "password": "x" * 129},
        {**REGISTER, "full_name": "   "},
        {**REGISTER, "full_name": "x" * 101},
        {**REGISTER, "email": "not-an-email"},
        {**REGISTER, "is_admin": True},  # mass assignment rejected
    ]
    for payload in cases:
        assert client.post("/auth/register", json=payload).status_code == 422, payload


def test_password_is_hashed_at_rest(client, db_session):
    client.post("/auth/register", json=REGISTER)
    user = db_session.query(User).one()
    assert user.hashed_password != REGISTER["password"]
    assert user.hashed_password.startswith("$argon2")


def test_login_success_and_case_insensitive_email(client):
    client.post("/auth/register", json=REGISTER)
    response = client.post("/auth/login", data={"username": "ADA@example.com", "password": "secret123"})
    assert response.status_code == 200
    body = response.json()
    assert body["token_type"] == "bearer"
    claims = jwt.decode(body["access_token"], settings.SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
    assert claims["sub"].isdigit() and "exp" in claims and "iat" in claims


def test_login_invalid_password_and_unknown_email_look_identical(client):
    client.post("/auth/register", json=REGISTER)
    wrong = client.post("/auth/login", data={"username": "ada@example.com", "password": "wrong-pass"})
    unknown = client.post("/auth/login", data={"username": "nobody@example.com", "password": "wrong-pass"})
    assert wrong.status_code == unknown.status_code == 401
    assert wrong.json() == unknown.json() == {"detail": "Invalid email or password"}


def test_expired_token_rejected(client):
    headers = register_and_login(client, "exp@example.com")
    uid = user_id_of(client, headers)
    expired = make_token(str(uid), minutes=-1)
    response = client.get("/users/me", headers={"Authorization": f"Bearer {expired}"})
    assert response.status_code == 401
    assert response.json()["detail"] == "Token has expired"
    assert response.headers["www-authenticate"] == "Bearer"


def test_malformed_tokens_rejected_with_401(client):
    headers = register_and_login(client, "mal@example.com")
    uid = str(user_id_of(client, headers))
    bad_tokens = [
        "garbage",
        "a.b.c",
        make_token(uid, secret="wrong-secret-" + "x" * 32),  # bad signature
        make_token("not-a-number"),
        make_token(None),  # no sub
        make_token("999999"),  # unknown user
        jwt.encode({"sub": uid}, settings.SECRET_KEY, algorithm=settings.JWT_ALGORITHM),  # no exp
    ]
    for token in bad_tokens:
        response = client.get("/users/me", headers={"Authorization": f"Bearer {token}"})
        assert response.status_code == 401, token
    assert client.get("/users/me").status_code == 401


def test_inactive_user_cannot_login_or_use_token(client, db_session):
    headers = register_and_login(client, "gone@example.com")
    user = db_session.query(User).filter_by(email="gone@example.com").one()
    user.is_active = False
    db_session.commit()

    assert client.get("/users/me", headers=headers).status_code == 401
    login = client.post("/auth/login", data={"username": "gone@example.com", "password": "secret123"})
    assert login.status_code == 403
    assert "access_token" not in login.json()


def test_me_never_exposes_password_hash(client):
    headers = register_and_login(client, "me@example.com")
    body = client.get("/users/me", headers=headers).json()
    assert set(body) == {"id", "email", "full_name", "is_active", "is_admin", "created_at"}
