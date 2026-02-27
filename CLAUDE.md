# CLAUDE.md — Finance Tracker

This file provides essential context for AI assistants working on the Finance Tracker codebase.

---

## Project Overview

Finance Tracker is a personal finance management API built with **FastAPI**, **SQLAlchemy 2**, and **SQLite**. It includes a vanilla JS/HTML/CSS frontend served as static files. Key features include multi-account management, income/expense tracking, budget monitoring, and Excel import (Fineco bank format).

---

## Repository Structure

```
finance-tracker/
├── app/
│   ├── api/routes/          # FastAPI route handlers (auth, accounts, transactions, budgets, categories, import)
│   ├── core/
│   │   ├── config.py        # Pydantic Settings — all env var definitions
│   │   └── security.py      # JWT creation/verification, password hashing
│   ├── db/
│   │   └── session.py       # SQLAlchemy engine, SessionLocal, get_db dependency
│   ├── models/              # SQLAlchemy ORM models (User, Account, Transaction, Category, Budget)
│   ├── schemas/             # Pydantic v2 request/response models
│   ├── services/            # Business logic (auth service, etc.)
│   ├── static/              # Frontend: index.html, app.js (~600 lines), style.css
│   └── main.py              # FastAPI app factory, router registration, static file mount
├── alembic/
│   ├── env.py               # Pulls DATABASE_URL from app settings
│   └── versions/            # Migration files (tracked in git)
├── tests/
│   ├── conftest.py          # Shared fixtures: in-memory SQLite client, auth_client
│   ├── test_auth.py         # Auth endpoint tests
│   └── test_transactions.py # Comprehensive integration tests for all endpoints
├── .github/
│   ├── workflows/ci.yml     # CI: lint (ruff) + test matrix (Python 3.11/3.12/3.13)
│   └── dependabot.yml       # Weekly pip + GitHub Actions dependency updates
├── requirements.txt         # Python dependencies
├── .env.example             # Template for environment variables
└── README.md                # End-user documentation and API reference
```

---

## Technology Stack

| Layer | Technology |
|-------|-----------|
| Language | Python 3.11+ |
| Web Framework | FastAPI 0.115+ |
| ORM | SQLAlchemy 2.x (Mapped type hints style) |
| Database | SQLite via Alembic migrations |
| Auth | JWT (HS256, python-jose) + bcrypt |
| Validation | Pydantic v2 + pydantic-settings |
| Testing | pytest + pytest-asyncio + httpx |
| Linter/Formatter | ruff |
| CI/CD | GitHub Actions |
| Frontend | Vanilla HTML5 / CSS3 / JavaScript |

---

## Development Workflow

### Initial Setup

```bash
python -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
# Edit .env — generate SECRET_KEY:
python -c "import secrets; print(secrets.token_hex(32))"
alembic upgrade head               # Apply DB migrations
```

### Running the Dev Server

```bash
uvicorn app.main:app --reload
# API:    http://127.0.0.1:8000
# Docs:   http://127.0.0.1:8000/docs
# UI:     http://127.0.0.1:8000/
```

### Running Tests

```bash
pytest tests/ -v                   # Full suite
pytest tests/test_auth.py -v       # Single file
pytest -k test_summary -v          # Pattern match
pytest --tb=short                  # Compact tracebacks
```

### Linting & Formatting

```bash
ruff check .                       # Lint
ruff format .                      # Format (auto-fix)
ruff format --check .              # Format check only (CI mode)
```

### Database Migrations

```bash
alembic upgrade head                                        # Apply all migrations
alembic revision --autogenerate -m "add column to table"   # Create new migration
alembic downgrade -1                                        # Rollback one step
```

---

## Key Conventions

### Architecture — Layered Pattern

```
HTTP Request → Route Handler (app/api/routes/)
            → Pydantic Schema validation (app/schemas/)
            → Service / Business Logic (app/services/)
            → SQLAlchemy Model (app/models/)
            → Database
```

- **Routes** handle HTTP, call DB/services, return schemas.
- **Schemas** handle input validation and response serialization.
- **Models** are SQLAlchemy ORM objects — never expose directly to HTTP responses.
- **Services** encapsulate auth logic and reusable business operations.

### Dependency Injection

All routes use FastAPI `Depends()` for database sessions and authentication:

```python
@router.get("/")
def list_items(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ...
```

Never import `SessionLocal` directly in route handlers — always use `get_db`.

### Authorization — Owner-Based Access Control

Every resource (Account, Transaction, Budget, Category) stores `owner_id`. All queries **must** filter by `owner_id == current_user.id`. Use a consistent helper pattern to return 404 for unauthorized access (do not leak resource existence):

```python
def _get_account_or_404(db, account_id, owner_id):
    account = db.get(Account, account_id)
    if not account or account.owner_id != owner_id:
        raise HTTPException(status_code=404, detail="Account not found")
    return account
```

### Sign Convention for Transaction Amounts

- **Income:** positive amount (e.g., `+1500.00`)
- **Expense:** negative amount (e.g., `-49.99`)
- The `transaction_type` field (`"income"` | `"expense"`) is denormalized for readability.
- The `TransactionCreate` Pydantic schema uses `@model_validator` to automatically negate expense amounts.
- Balance updates use simple addition: `account.balance += transaction.amount`.

### Financial Precision

Always use `NUMERIC(15, 2)` column type for monetary values — never Python `float`. In Python, use `Decimal` when performing arithmetic outside the DB.

### Naming Conventions

- **Models:** CamelCase — `User`, `Account`, `Transaction`
- **Schema classes:** CamelCase with suffix — `AccountCreate`, `TransactionResponse`
- **Route functions:** snake_case — `create_account`, `list_transactions`
- **Private helpers:** underscore-prefixed — `_get_account_or_404`, `_owned_account_ids`
- **DB columns:** snake_case — `owner_id`, `created_at`, `transaction_type`
- **URL paths:** kebab-case or snake_case, plural nouns — `/accounts/`, `/transactions/`

### SQLAlchemy 2.x Style

Use `Mapped` type hints for all model columns:

```python
class Account(Base):
    __tablename__ = "accounts"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100))
    owner_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
```

### Type Hints

Use Python 3.11+ union syntax throughout:

```python
description: str | None = None   # ✓ correct
description: Optional[str] = None  # ✗ avoid
```

---

## Testing Conventions

### Test Fixtures (`tests/conftest.py`)

- `client` — `TestClient` with isolated **in-memory SQLite** database; tables created/dropped per test via autouse fixture.
- `auth_client` — Pre-registered and logged-in client (JWT token injected into headers).

### Writing Tests

- Use `auth_client` for endpoints that require authentication.
- Always verify **cross-user isolation** when adding new resource types (attempt access with a second user's credentials).
- Test file naming: `test_<feature>.py`.
- Use `pytest -k <pattern>` to run targeted tests during development.

### DB Isolation

Tests override the `get_db` dependency to inject an in-memory SQLite session with `StaticPool`. Never reference the real `finance.db` in tests.

---

## Environment Variables

Defined in `app/core/config.py` via Pydantic `BaseSettings`. All loaded from `.env`:

| Variable | Default | Notes |
|----------|---------|-------|
| `SECRET_KEY` | `"change-me-in-production..."` | **Required in prod** — generate with `secrets.token_hex(32)` |
| `ALGORITHM` | `"HS256"` | JWT signing algorithm |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `60` | Token lifetime |
| `DATABASE_URL` | `"sqlite:///./finance.db"` | Swap for PostgreSQL URL in production |
| `APP_NAME` | `"Finance Tracker"` | Display name |
| `DEBUG` | `false` | Enable debug mode |

---

## CI/CD Pipeline

Defined in `.github/workflows/ci.yml`. Triggers on push to `main` and pull requests to `main`.

**Lint job** (Python 3.12):
1. `ruff check .`
2. `ruff format --check .`

**Test job** (matrix: Python 3.11, 3.12, 3.13):
1. `pip install -r requirements.txt`
2. `pytest tests/ -v`

Both jobs must pass before merging.

**Dependabot** runs weekly (Mondays) to batch-update pip packages and GitHub Actions.

---

## Adding New Features — Checklist

When adding a new resource/endpoint:

1. **Model** — Add `app/models/<name>.py` with `Mapped` type hints; add relationship to `User` model.
2. **Schema** — Add `app/schemas/<name>.py` with `Create`, `Update`, and `Response` variants.
3. **Route** — Add `app/api/routes/<name>.py`; register in `app/main.py`.
4. **Migration** — Run `alembic revision --autogenerate -m "add <name> table"` and review the generated file.
5. **Tests** — Add `tests/test_<name>.py` covering CRUD and authorization (cross-user access).
6. **Frontend** — If needed, update `app/static/app.js` and `app/static/index.html`.

---

## Common Pitfalls

- **Do not** use `Base.metadata.create_all()` in production — use `alembic upgrade head` instead.
- **Do not** store amounts as Python `float` — use `Decimal` or let the DB handle it via `NUMERIC`.
- **Do not** return SQLAlchemy model objects directly — always pass through a Pydantic response schema.
- **Do not** skip owner checks — every DB query for user-owned resources must filter by `owner_id`.
- **Do not** commit `.env` files — only commit `.env.example` with placeholder values.
- When modifying Alembic migrations for SQLite, ensure `render_as_batch=True` is set in `alembic/env.py` (already configured) because SQLite does not support `ALTER TABLE`.
