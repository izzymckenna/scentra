from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import db_session
from app.schemas.catalog import StoreOut
from app.schemas.filters import NearbyStoreQuery
from app.services.store_service import StoreService

router = APIRouter(prefix="/stores", tags=["stores"])


@router.get("/nearby", response_model=list[StoreOut])
async def nearby_stores(
    query: NearbyStoreQuery = Depends(),
    db: AsyncSession = Depends(db_session),
):
    rows = await StoreService(db).nearby(
        latitude=query.latitude,
        longitude=query.longitude,
        radius_km=query.radius_km,
        retailer_slugs=query.retailer,
    )
    return [
        StoreOut.model_validate({**store.__dict__, "distance_km": round(distance_km, 2)})
        for store, distance_km in rows
    ]
