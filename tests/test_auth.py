"""Integration tests for auth endpoints using an in-memory SQLite database."""
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

import app.models  # noqa: F401 — registers all ORM models with Base.metadata
from app.db.session import Base, get_db
from app.main import app

# StaticPool makes every checkout return the same underlying connection,
# so the in-memory database created by create_all() is visible to all sessions.
engine = create_engine(
    "sqlite://",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture(autouse=True)
def setup_db():
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


@pytest.fixture
def client():
    def override_get_db():
        db = TestingSessionLocal()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


def test_register_and_login(client):
    # Register
    resp = client.post(
        "/auth/register",
        json={"email": "alice@example.com", "password": "secret123", "full_name": "Alice"},
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["email"] == "alice@example.com"

    # Login
    resp = client.post(
        "/auth/login",
        data={"username": "alice@example.com", "password": "secret123"},
    )
    assert resp.status_code == 200
    assert "access_token" in resp.json()


def test_duplicate_email(client):
    payload = {"email": "bob@example.com", "password": "pw", "full_name": "Bob"}
    client.post("/auth/register", json=payload)
    resp = client.post("/auth/register", json=payload)
    assert resp.status_code == 400


def test_wrong_password(client):
    client.post(
        "/auth/register",
        json={"email": "carol@example.com", "password": "correct", "full_name": "Carol"},
    )
    resp = client.post(
        "/auth/login",
        data={"username": "carol@example.com", "password": "wrong"},
    )
    assert resp.status_code == 401
