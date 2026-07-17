from __future__ import annotations

from sqlalchemy import Float, cast, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.models import Retailer, Store


class StoreService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db
        self.settings = get_settings()

    async def nearby(
        self,
        latitude: float,
        longitude: float,
        radius_km: float | None = None,
        retailer_slugs: list[str] | None = None,
    ) -> list[tuple[Store, float]]:
        radius = min(radius_km or self.settings.nz_default_radius_km, self.settings.nz_max_radius_km)
        point = func.ST_SetSRID(func.ST_MakePoint(longitude, latitude), 4326)
        distance_m = func.ST_Distance(Store.location, point).label("distance_m")
        query = (
            select(Store, cast(distance_m / 1000, Float).label("distance_km"))
            .join(Retailer, Retailer.id == Store.retailer_id)
            .where(Store.country_code == "NZ")
            .where(func.ST_DWithin(Store.location, point, radius * 1000))
            .order_by(distance_m.asc())
            .limit(100)
        )
        if retailer_slugs:
            query = query.where(Retailer.slug.in_(retailer_slugs))
        result = await self.db.execute(query)
        return [(store, distance_km) for store, distance_km in result.all()]
