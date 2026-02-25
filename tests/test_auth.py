"""Integration tests for auth endpoints."""
import pytest  # noqa: F401 — fixtures injected via conftest


def test_register_and_login(client):
    resp = client.post(
        "/auth/register",
        json={"email": "alice@example.com", "password": "secret123", "full_name": "Alice"},
    )
    assert resp.status_code == 201
    assert resp.json()["email"] == "alice@example.com"

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
