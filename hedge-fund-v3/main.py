from contextlib import asynccontextmanager
from fastapi import FastAPI
from app.api import router
from app.cache import close_redis
from app.config import get_settings
from app.db import init_db
from app.logging import setup_logging
from app.version import APP_VERSION, MODEL_VERSION


@asynccontextmanager
async def lifespan(app: FastAPI):
    setup_logging()
    await init_db()
    yield
    await close_redis()


app = FastAPI(
    title="Hedge Fund V3",
    description="Multi-agent stock analysis system",
    version=APP_VERSION,
    lifespan=lifespan,
)

app.include_router(router, prefix="/api/v3")


if __name__ == "__main__":
    import uvicorn

    settings = get_settings()
    uvicorn.run(
        "main:app",
        host=settings.api_host,
        port=settings.api_port,
        reload=settings.api_reload,
    )
