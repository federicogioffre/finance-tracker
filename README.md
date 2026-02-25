# Finance Tracker

[![CI](https://github.com/federicogioffre/finance-tracker/actions/workflows/ci.yml/badge.svg)](https://github.com/federicogioffre/finance-tracker/actions/workflows/ci.yml)

A personal finance REST API built with **FastAPI**, **SQLAlchemy 2**, and **SQLite**.

## Features

- JWT-based authentication (register / login)
- Multiple accounts per user (checking, savings, credit, etc.)
- Transaction recording with automatic balance updates
- User-defined income / expense categories
- Summary endpoint (total income, expenses, net) with optional date filtering
- Full test suite using an in-memory SQLite database

---

## Project Structure

```
finance-tracker/
├── app/
│   ├── api/
│   │   └── routes/
│   │       ├── auth.py          # /auth/register, /auth/login
│   │       ├── accounts.py      # CRUD for accounts
│   │       ├── transactions.py  # CRUD for transactions + categories + summary
│   │       └── users.py         # /users/me
│   ├── core/
│   │   ├── config.py            # Settings loaded from .env
│   │   └── security.py          # Password hashing + JWT helpers
│   ├── db/
│   │   └── session.py           # SQLAlchemy engine, session, Base, get_db()
│   ├── models/                  # SQLAlchemy ORM models
│   ├── schemas/                 # Pydantic request/response schemas
│   ├── services/
│   │   └── auth.py              # get_current_user() FastAPI dependency
│   └── main.py                  # App factory + router registration
├── tests/
│   └── test_auth.py
├── .env.example
├── .gitignore
├── requirements.txt
└── README.md
```

---

## Quick Start

```bash
# 1. Create and activate a virtual environment
python -m venv .venv
source .venv/bin/activate      # Windows: .venv\Scripts\activate

# 2. Install dependencies
pip install -r requirements.txt

# 3. Configure secrets
cp .env.example .env
# Edit .env — at minimum set a strong SECRET_KEY:
# python -c "import secrets; print(secrets.token_hex(32))"

# 4. Run the server
uvicorn app.main:app --reload

# 5. Open the interactive docs
# http://127.0.0.1:8000/docs
```

---

## API Overview

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/auth/register` | No | Create account |
| POST | `/auth/login` | No | Get JWT token |
| GET | `/users/me` | Yes | Current user profile |
| GET/POST | `/accounts` | Yes | List / create accounts |
| GET/PATCH/DELETE | `/accounts/{id}` | Yes | Read / update / delete account |
| GET/POST | `/transactions` | Yes | List / create transactions |
| GET | `/transactions/summary` | Yes | Income, expense, net totals |
| GET/PATCH/DELETE | `/transactions/{id}` | Yes | Read / update / delete transaction |
| GET/POST | `/categories` | Yes | List / create categories |

### Authentication

All protected endpoints require:
```
Authorization: Bearer <access_token>
```

The Swagger UI at `/docs` has a built-in **Authorize** button for convenience.

---

## Running Tests

```bash
pytest -v
```

---

## Design Decisions

### SQLite + SQLAlchemy 2
SQLite requires zero infrastructure, making the project self-contained.
`connect_args={"check_same_thread": False}` is required because FastAPI's
thread pool would otherwise trigger SQLite's single-thread guard.
SQLAlchemy 2's `Mapped` / `mapped_column` style gives full type inference
without separate `__annotations__`.

### Single `amount` column with sign convention
Expenses are stored as negative values (`amount = -50.00`).
This lets you compute a balance with a single `SUM(amount)` query rather
than `SUM(income) - SUM(expenses)`.  A parallel `transaction_type` column
is kept as a denormalized filter for readability.

### JWT (stateless) over sessions
No server-side session storage is needed; tokens are self-contained and
work naturally with mobile / SPA clients.  The tradeoff is that tokens
cannot be revoked before expiry — add a token blocklist (Redis) if needed.

### Pydantic `model_validator` for amount normalization
Business logic (sign enforcement) lives in the schema layer rather than
the route, keeping the route handlers thin and making the rule testable
in isolation.

### `Base.metadata.create_all` on startup
Acceptable for a single-developer project.  For team projects, replace
with **Alembic** migrations (`alembic init alembic`) to track schema
changes under version control.

### Dependency injection for `get_db` and `get_current_user`
FastAPI's `Depends` system makes both the database session and the
current user easily swappable in tests (override `get_db` with an
in-memory session) without touching application code.
