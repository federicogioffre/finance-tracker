from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.api.routes import accounts, auth, transactions, users
from app.core.config import settings
from app.db.session import Base, engine


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Create all tables on startup (use Alembic migrations in production)
    Base.metadata.create_all(bind=engine)
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


@app.get("/health", tags=["health"])
def health():
    return {"status": "ok"}
