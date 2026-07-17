from __future__ import annotations

from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "Scentra API"
    environment: str = "local"
    database_url: str = Field(
        default="postgresql+asyncpg://scentra:scentra@localhost:5432/scentra"
    )
    redis_url: str = "redis://localhost:6379/0"
    meilisearch_url: str = "http://localhost:7700"
    meilisearch_api_key: str = "masterKey"
    search_index_products: str = "scentra_products"
    cache_ttl_seconds: int = 300
    nz_default_radius_km: int = 20
    nz_max_radius_km: int = 100
    price_scrape_urls: list[str] = Field(default_factory=list)
    nightly_cron_token: str = ""

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")


@lru_cache
def get_settings() -> Settings:
    return Settings()
