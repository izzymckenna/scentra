from __future__ import annotations

from fastapi import APIRouter, Query

from app.importers.live_retailers import DEFAULT_PERFUME_RETAILERS
from app.services.perfume_scrape_service import PerfumeScrapeService

router = APIRouter(tags=["perfumes"])


@router.get("/perfumes/live")
async def live_perfumes(
    retailer_slugs: list[str] = Query(default=DEFAULT_PERFUME_RETAILERS),
    terms: list[str] | None = Query(default=None),
    limit_per_retailer: int = Query(default=100, ge=1, le=1000),
):
    payload = await PerfumeScrapeService().scrape(
        retailer_slugs=retailer_slugs,
        terms=terms,
        limit_per_retailer=limit_per_retailer,
    )
    return payload
