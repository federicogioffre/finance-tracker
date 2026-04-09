import json
from typing import Any
import redis.asyncio as aioredis
from app.config import get_settings
from app.version import MODEL_VERSION, DATA_VERSION

_redis_client: aioredis.Redis | None = None


async def get_redis() -> aioredis.Redis:
    global _redis_client
    if _redis_client is None:
        settings = get_settings()
        _redis_client = aioredis.from_url(
            settings.redis_url,
            encoding="utf-8",
            decode_responses=True,
        )
    return _redis_client


async def close_redis() -> None:
    global _redis_client
    if _redis_client is not None:
        await _redis_client.close()
        _redis_client = None


def make_cache_key(ticker: str, horizon: int = 90) -> str:
    return f"analysis:{ticker.upper()}:{MODEL_VERSION}:{DATA_VERSION}:{horizon}"


async def get_cached_analysis(ticker: str, horizon: int = 90) -> dict | None:
    redis = await get_redis()
    key = make_cache_key(ticker, horizon)
    data = await redis.get(key)
    if data is not None:
        return json.loads(data)
    return None


async def set_cached_analysis(ticker: str, result: dict, ttl: int = 300, horizon: int = 90) -> None:
    redis = await get_redis()
    key = make_cache_key(ticker, horizon)
    await redis.set(key, json.dumps(result), ex=ttl)


async def invalidate_cache(ticker: str, horizon: int | None = None) -> None:
    redis = await get_redis()
    if horizon is not None:
        key = make_cache_key(ticker, horizon)
        await redis.delete(key)
    else:
        pattern = f"analysis:{ticker.upper()}:*"
        async for key in redis.scan_iter(match=pattern):
            await redis.delete(key)
