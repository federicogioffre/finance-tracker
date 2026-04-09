import time
from fastapi import HTTPException, Request
from app.cache import get_redis
from app.config import get_settings


async def rate_limit_check(request: Request) -> None:
    settings = get_settings()
    client_ip = request.client.host if request.client else "unknown"
    key = f"rate_limit:{client_ip}"

    redis = await get_redis()
    current = await redis.get(key)

    if current is not None and int(current) >= settings.rate_limit_requests:
        raise HTTPException(
            status_code=429,
            detail="Rate limit exceeded. Try again later.",
        )

    pipe = redis.pipeline()
    pipe.incr(key)
    pipe.expire(key, settings.rate_limit_window)
    await pipe.execute()
