from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Retailer


class RetailerService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def approved_retailers(self) -> list[Retailer]:
        result = await self.db.execute(select(Retailer).where(Retailer.approved.is_(True)).order_by(Retailer.name))
        return list(result.scalars().all())
