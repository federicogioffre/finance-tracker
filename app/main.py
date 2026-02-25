from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from app.api.routes import accounts, auth, budgets, transactions, users
from app.core.config import settings


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Tables are managed by Alembic — run `alembic upgrade head` before starting.
    yield


app = FastAPI(
    title=settings.APP_NAME,
    description="Track income, expenses, and account balances across multiple accounts.",
    version="1.0.0",
    lifespan=lifespan,
)

app.include_router(auth.router)
app.include_router(users.router)
app.include_router(accounts.router)
app.include_router(transactions.router)
app.include_router(budgets.router)


@app.get("/health", tags=["health"])
def health():
    return {"status": "ok"}


# Static mount must come last — it acts as a catch-all
app.mount("/", StaticFiles(directory="app/static", html=True), name="static")
