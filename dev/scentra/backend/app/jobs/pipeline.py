from __future__ import annotations

from dataclasses import dataclass
from typing import Any

import httpx
from sqlalchemy.ext.asyncio import AsyncSession

from app.cache.redis_client import Cache
from app.services.deal_service import DealService
from app.services.import_service import ImportService
from app.services.live_import_service import LiveImportService


@dataclass
class RetailerFeed:
    retailer_id: int
    source_name: str
    url: str


class DailyPricePipeline:
    def __init__(self, db: AsyncSession, cache: Cache | None = None) -> None:
        self.db = db
        self.cache = cache or Cache()

    async def run(self, feeds: list[RetailerFeed]) -> dict[str, Any]:
        imports = []
        async with httpx.AsyncClient(timeout=60) as client:
            for feed in feeds:
                response = await client.get(feed.url)
                response.raise_for_status()
                rows = response.json()
                run = await ImportService(self.db).import_rows(
                    retailer_id=feed.retailer_id,
                    source_name=feed.source_name,
                    rows=rows,
                )
                imports.append({"id": run.id, "source_name": run.source_name, "status": run.status.value})

        deal_count = await DealService(self.db, self.cache).recalculate_active_deals()
        await self.cache.delete_pattern("scentra:explore:*")
        await self.cache.delete_pattern("scentra:deals:*")
        return {"imports": imports, "deals_recalculated": deal_count}

    async def run_live_nz_retailers(
        self,
        retailer_slugs: list[str] | None = None,
        terms: list[str] | None = None,
        limit_per_retailer: int = 250,
    ) -> dict[str, Any]:
        results = await LiveImportService(self.db).import_retailers(
            retailer_slugs=retailer_slugs or ["life-pharmacy", "chemist-warehouse-nz", "lush", "farmers"],
            terms=terms,
            limit_per_retailer=limit_per_retailer,
        )
        await self.cache.delete_pattern("scentra:explore:*")
        await self.cache.delete_pattern("scentra:deals:*")
        return {"imports": results}
