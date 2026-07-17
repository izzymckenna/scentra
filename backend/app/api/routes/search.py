from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import db_session
from app.schemas.catalog import SearchResultOut
from app.schemas.filters import ExploreFilters
from app.services.search_service import SearchService

router = APIRouter(tags=["search"])


@router.get("/search", response_model=SearchResultOut)
async def search_products(
    q: str | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    per_page: int = Query(default=20, ge=1, le=100),
    db: AsyncSession = Depends(db_session),
):
    return await SearchService(db).product_search(q, page, per_page)


@router.get("/explore", response_model=SearchResultOut)
async def explore_products(
    filters: ExploreFilters = Depends(),
    db: AsyncSession = Depends(db_session),
):
    return await SearchService(db).explore(filters)
