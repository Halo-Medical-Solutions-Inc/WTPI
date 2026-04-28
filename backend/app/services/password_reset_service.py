import secrets
from typing import Optional

from app.config import settings
from app.database.redis_client import get_redis

RESET_TOKEN_PREFIX = "password_reset:"
RATE_LIMIT_PREFIX = "password_reset_rate:"


def _generate_token() -> str:
    return secrets.token_urlsafe(32)


async def create_reset_token(email: str) -> Optional[str]:
    redis = await get_redis()
    rate_key = f"{RATE_LIMIT_PREFIX}{email.lower()}"

    current_count = await redis.get(rate_key)
    if current_count and int(current_count) >= settings.PASSWORD_RESET_MAX_REQUESTS:
        return None

    token = _generate_token()
    token_key = f"{RESET_TOKEN_PREFIX}{token}"
    expiry_seconds = settings.PASSWORD_RESET_EXPIRY_HOURS * 3600

    await redis.setex(token_key, expiry_seconds, email.lower())

    if current_count is None:
        await redis.setex(rate_key, 3600, 1)
    else:
        await redis.incr(rate_key)

    return token


async def verify_reset_token(token: str) -> Optional[str]:
    redis = await get_redis()
    token_key = f"{RESET_TOKEN_PREFIX}{token}"
    email = await redis.get(token_key)
    return email


async def consume_reset_token(token: str) -> Optional[str]:
    redis = await get_redis()
    token_key = f"{RESET_TOKEN_PREFIX}{token}"
    email = await redis.get(token_key)
    if email:
        await redis.delete(token_key)
    return email
