from __future__ import annotations

import json
from typing import Any

from redis.asyncio import Redis

from app.core.config import get_settings


class Cache:
    def __init__(self) -> None:
        settings = get_settings()
        self.redis = Redis.from_url(settings.redis_url, decode_responses=True)
        self.ttl = settings.cache_ttl_seconds

    async def get_json(self, key: str) -> dict[str, Any] | list[Any] | None:
        value = await self.redis.get(key)
        if value is None:
            return None
        return json.loads(value)

    async def set_json(self, key: str, value: dict[str, Any] | list[Any], ttl: int | None = None) -> None:
        await self.redis.set(key, json.dumps(value, default=str), ex=ttl or self.ttl)

    async def delete_pattern(self, pattern: str) -> None:
        async for key in self.redis.scan_iter(match=pattern):
            await self.redis.delete(key)


def cache_key(namespace: str, **parts: Any) -> str:
    stable = ":".join(f"{key}={parts[key]}" for key in sorted(parts))
    return f"scentra:{namespace}:{stable}"
