import json
from typing import Any, Dict, List

from app.database.redis_client import get_redis

CHANNEL_NAME = "wtpi_events"


async def publish_event(event_type: str, data: Dict[str, Any]) -> None:
    redis = await get_redis()
    message = json.dumps({"type": event_type, "data": data})
    await redis.publish(CHANNEL_NAME, message)


async def publish_to_users(
    event_type: str,
    data: Dict[str, Any],
    user_ids: List[str],
) -> None:
    redis = await get_redis()
    message = json.dumps({
        "type": event_type,
        "data": data,
        "target_user_ids": user_ids,
    })
    await redis.publish(CHANNEL_NAME, message)
