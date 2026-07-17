from __future__ import annotations

from fastapi import APIRouter, Depends, Header, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import db_session
from app.core.config import get_settings
from app.importers import LiveRetailerImportError, live_importer_for_slug
from app.schemas.admin import (
    ImportFeedRequest,
    LiveImportRequest,
    LivePreviewRequest,
    MergeProductsRequest,
    PriceScrapeRequest,
    PerfumeScrapeRequest,
)
from app.services.deal_service import DealService
from app.services.import_service import ImportService
from app.services.live_import_service import LiveImportService
from app.services.perfume_scrape_service import PerfumeScrapeService
from app.services.price_scrape_service import PriceScrapeService
from app.services.product_service import ProductService
from app.jobs.worker import enqueue_daily_import, enqueue_perfume_scrape, enqueue_price_scrape

router = APIRouter(prefix="/admin", tags=["admin"])


def require_cron_token(x_cron_token: str | None = Header(default=None, alias="X-Cron-Token")) -> None:
    settings = get_settings()
    if settings.nightly_cron_token and x_cron_token != settings.nightly_cron_token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid cron token")


@router.post("/imports", status_code=status.HTTP_202_ACCEPTED)
async def import_feed(payload: ImportFeedRequest, db: AsyncSession = Depends(db_session)):
    # Feed fetching is queued in production; this endpoint records the intent for admin tools.
    run = await ImportService(db).import_rows(
        retailer_id=payload.retailer_id,
        source_name=payload.source_name,
        rows=[],
        dry_run=payload.dry_run,
    )
    return {"import_run_id": run.id, "status": run.status.value}


@router.post("/imports/live", status_code=status.HTTP_202_ACCEPTED)
async def import_live_retailer_data(payload: LiveImportRequest, db: AsyncSession = Depends(db_session)):
    return {
        "results": await LiveImportService(db).import_retailers(
            retailer_slugs=payload.retailer_slugs,
            terms=payload.terms,
            limit_per_retailer=payload.limit_per_retailer,
            dry_run=payload.dry_run,
        )
    }


@router.post("/imports/live/preview")
async def preview_live_retailer_data(payload: LivePreviewRequest):
    results = []
    for slug in payload.retailer_slugs:
        try:
            importer = live_importer_for_slug(slug)
            rows = await importer.fetch_rows(terms=payload.terms, limit=payload.limit_per_retailer)
            results.append({"retailer_slug": slug, "status": "ok", "rows": rows, "row_count": len(rows)})
        except LiveRetailerImportError as exc:
            results.append({"retailer_slug": slug, "status": "failed", "rows": [], "row_count": 0, "error": str(exc)})
    return {"results": results}


@router.post("/scrape/prices")
async def scrape_prices(payload: PriceScrapeRequest):
    service = PriceScrapeService()
    return {"results": await service.scrape_urls([str(url) for url in payload.urls], limit=payload.limit)}


@router.post("/imports/live/perfumes")
async def scrape_perfumes(payload: PerfumeScrapeRequest):
    service = PerfumeScrapeService()
    return {
        "results": await service.scrape(
            retailer_slugs=payload.retailer_slugs,
            terms=payload.terms,
            limit_per_retailer=payload.limit_per_retailer,
        )
    }


@router.post("/products/merge")
async def merge_products(payload: MergeProductsRequest, db: AsyncSession = Depends(db_session)):
    await ProductService(db).merge_products(payload.canonical_product_id, payload.duplicate_product_id)
    return {"merged": True}


@router.post("/deals/recalculate")
async def recalculate_deals(db: AsyncSession = Depends(db_session)):
    count = await DealService(db).recalculate_active_deals()
    return {"updated": count}


@router.post("/cron/nightly", status_code=status.HTTP_202_ACCEPTED, dependencies=[Depends(require_cron_token)])
async def run_nightly_scrapes():
    daily_import_job_id = await enqueue_daily_import()
    price_scrape_job_id = await enqueue_price_scrape()
    perfume_scrape_job_id = await enqueue_perfume_scrape()
    return {
        "queued": True,
        "jobs": {
            "daily_import": daily_import_job_id,
            "price_scrape": price_scrape_job_id,
            "perfume_scrape": perfume_scrape_job_id,
        },
    }
