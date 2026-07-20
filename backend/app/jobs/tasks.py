from __future__ import annotations

import asyncio

from app.core.config import get_settings
from app.db.session import AsyncSessionLocal
from app.jobs.pipeline import DailyPricePipeline
from app.services.perfume_scrape_service import PerfumeScrapeService
from app.services.price_scrape_service import PriceScrapeService


async def _run_daily_import_async() -> dict:
    async with AsyncSessionLocal() as db:
        pipeline = DailyPricePipeline(db)
        return await pipeline.run_live_nz_retailers()


def run_daily_import() -> dict:
    return asyncio.run(_run_daily_import_async())


async def _run_price_scrape_async() -> dict:
    settings = get_settings()
    results = await PriceScrapeService().scrape_urls(settings.price_scrape_urls, limit=len(settings.price_scrape_urls))
    return {"results": results}


def run_price_scrape() -> dict:
    return asyncio.run(_run_price_scrape_async())


async def _run_perfume_scrape_async() -> dict:
    results = await PerfumeScrapeService().scrape(
        retailer_slugs=["life-pharmacy", "chemist-warehouse-nz"],
    )
    return {"results": results}


def run_perfume_scrape() -> dict:
    return asyncio.run(_run_perfume_scrape_async())
