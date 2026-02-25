"""Integration tests for accounts, transactions, and summary endpoints."""
import pytest  # noqa: F401 — fixtures injected via conftest


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def create_account(client, name="Checking", balance="1000.00"):
    resp = client.post(
        "/accounts/",
        json={"name": name, "account_type": "checking", "balance": balance},
    )
    assert resp.status_code == 201
    return resp.json()


def create_tx(client, account_id, amount, tx_type, description=None):
    resp = client.post(
        "/transactions",
        json={
            "account_id": account_id,
            "amount": amount,
            "transaction_type": tx_type,
            "description": description,
        },
    )
    assert resp.status_code == 201
    return resp.json()


# ---------------------------------------------------------------------------
# Account tests
# ---------------------------------------------------------------------------

def test_create_and_list_account(auth_client):
    acct = create_account(auth_client)
    assert acct["name"] == "Checking"
    assert float(acct["balance"]) == 1000.0

    resp = auth_client.get("/accounts/")
    assert resp.status_code == 200
    assert len(resp.json()) == 1


def test_get_account(auth_client):
    acct = create_account(auth_client)
    resp = auth_client.get(f"/accounts/{acct['id']}")
    assert resp.status_code == 200
    assert resp.json()["id"] == acct["id"]


def test_update_account(auth_client):
    acct = create_account(auth_client)
    resp = auth_client.patch(f"/accounts/{acct['id']}", json={"name": "Savings"})
    assert resp.status_code == 200
    assert resp.json()["name"] == "Savings"


def test_delete_account(auth_client):
    acct = create_account(auth_client)
    resp = auth_client.delete(f"/accounts/{acct['id']}")
    assert resp.status_code == 204

    resp = auth_client.get(f"/accounts/{acct['id']}")
    assert resp.status_code == 404


def test_cannot_access_other_users_account(client, auth_client):
    # Register a second user with their own account
    client.post(
        "/auth/register",
        json={"email": "other@example.com", "password": "pw", "full_name": "Other"},
    )
    resp = client.post(
        "/auth/login",
        data={"username": "other@example.com", "password": "pw"},
    )
    other_token = resp.json()["access_token"]
    resp = client.post(
        "/accounts/",
        json={"name": "Other account"},
        headers={"Authorization": f"Bearer {other_token}"},
    )
    other_acct_id = resp.json()["id"]

    # auth_client (first user) should get 404 for the second user's account
    assert auth_client.get(f"/accounts/{other_acct_id}").status_code == 404


# ---------------------------------------------------------------------------
# Transaction CRUD
# ---------------------------------------------------------------------------

def test_create_income_transaction(auth_client):
    acct = create_account(auth_client, balance="0.00")
    tx = create_tx(auth_client, acct["id"], "500.00", "income", "Salary")

    assert tx["transaction_type"] == "income"
    assert float(tx["amount"]) == 500.0
    assert tx["description"] == "Salary"

    # Balance should have increased
    acct_resp = auth_client.get(f"/accounts/{acct['id']}").json()
    assert float(acct_resp["balance"]) == 500.0


def test_create_expense_transaction(auth_client):
    acct = create_account(auth_client, balance="1000.00")
    tx = create_tx(auth_client, acct["id"], "200.00", "expense", "Rent")

    # Schema normalises expenses to negative storage
    assert float(tx["amount"]) == -200.0
    assert tx["transaction_type"] == "expense"

    acct_resp = auth_client.get(f"/accounts/{acct['id']}").json()
    assert float(acct_resp["balance"]) == 800.0


def test_list_transactions(auth_client):
    acct = create_account(auth_client)
    create_tx(auth_client, acct["id"], "100.00", "income")
    create_tx(auth_client, acct["id"], "50.00", "expense")

    resp = auth_client.get("/transactions")
    assert resp.status_code == 200
    assert len(resp.json()) == 2


def test_list_transactions_filter_by_type(auth_client):
    acct = create_account(auth_client)
    create_tx(auth_client, acct["id"], "100.00", "income")
    create_tx(auth_client, acct["id"], "50.00", "expense")

    resp = auth_client.get("/transactions?transaction_type=income")
    assert len(resp.json()) == 1
    assert resp.json()[0]["transaction_type"] == "income"


def test_get_transaction(auth_client):
    acct = create_account(auth_client)
    tx = create_tx(auth_client, acct["id"], "75.00", "income")

    resp = auth_client.get(f"/transactions/{tx['id']}")
    assert resp.status_code == 200
    assert resp.json()["id"] == tx["id"]


def test_update_transaction_description(auth_client):
    acct = create_account(auth_client)
    tx = create_tx(auth_client, acct["id"], "30.00", "expense", "Coffee")

    resp = auth_client.patch(f"/transactions/{tx['id']}", json={"description": "Lunch"})
    assert resp.status_code == 200
    assert resp.json()["description"] == "Lunch"


def test_delete_transaction_reverses_balance(auth_client):
    acct = create_account(auth_client, balance="1000.00")
    tx = create_tx(auth_client, acct["id"], "400.00", "expense")

    # Balance after expense: 600
    assert float(auth_client.get(f"/accounts/{acct['id']}").json()["balance"]) == 600.0

    auth_client.delete(f"/transactions/{tx['id']}")

    # Balance restored after deletion
    assert float(auth_client.get(f"/accounts/{acct['id']}").json()["balance"]) == 1000.0


def test_transaction_not_found(auth_client):
    assert auth_client.get("/transactions/99999").status_code == 404


def test_cannot_post_to_other_users_account(client, auth_client):
    # Create account for a second user
    client.post(
        "/auth/register",
        json={"email": "eve@example.com", "password": "pw", "full_name": "Eve"},
    )
    resp = client.post("/auth/login", data={"username": "eve@example.com", "password": "pw"})
    eve_token = resp.json()["access_token"]
    resp = client.post(
        "/accounts/",
        json={"name": "Eve account"},
        headers={"Authorization": f"Bearer {eve_token}"},
    )
    eve_acct_id = resp.json()["id"]

    # auth_client tries to post a transaction to Eve's account
    resp = auth_client.post(
        "/transactions",
        json={"account_id": eve_acct_id, "amount": "100.00", "transaction_type": "income"},
    )
    assert resp.status_code == 403


# ---------------------------------------------------------------------------
# Summary endpoint
# ---------------------------------------------------------------------------

def test_summary_totals(auth_client):
    acct = create_account(auth_client, balance="0.00")
    create_tx(auth_client, acct["id"], "1000.00", "income")
    create_tx(auth_client, acct["id"], "300.00", "expense")
    create_tx(auth_client, acct["id"], "200.00", "expense")

    resp = auth_client.get("/transactions/summary")
    assert resp.status_code == 200
    data = resp.json()
    assert float(data["total_income"]) == 1000.0
    assert float(data["total_expenses"]) == 500.0
    assert float(data["net"]) == 500.0


def test_summary_empty(auth_client):
    resp = auth_client.get("/transactions/summary")
    assert resp.status_code == 200
    data = resp.json()
    assert float(data["total_income"]) == 0.0
    assert float(data["total_expenses"]) == 0.0
    assert float(data["net"]) == 0.0


# ---------------------------------------------------------------------------
# Categories
# ---------------------------------------------------------------------------

def test_create_and_list_category(auth_client):
    resp = auth_client.post(
        "/categories",
        json={"name": "Groceries", "category_type": "expense", "color": "#00FF00"},
    )
    assert resp.status_code == 201
    assert resp.json()["name"] == "Groceries"

    resp = auth_client.get("/categories")
    assert len(resp.json()) == 1


def test_transaction_with_category(auth_client):
    acct = create_account(auth_client)
    cat = auth_client.post(
        "/categories",
        json={"name": "Food", "category_type": "expense"},
    ).json()

    tx = create_tx(auth_client, acct["id"], "45.00", "expense")
    resp = auth_client.patch(
        f"/transactions/{tx['id']}",
        json={"category_id": cat["id"]},
    )
    assert resp.status_code == 200
    assert resp.json()["category_id"] == cat["id"]
