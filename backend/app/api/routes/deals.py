from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import db_session
from app.schemas.catalog import DealOut
from app.services.deal_service import DealService

router = APIRouter(prefix="/deals", tags=["deals"])


@router.get("", response_model=list[DealOut])
async def best_deals(
    limit: int = Query(default=50, ge=1, le=200),
    db: AsyncSession = Depends(db_session),
):
    return await DealService(db).best_deals(limit)
