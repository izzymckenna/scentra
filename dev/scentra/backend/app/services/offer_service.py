from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession

from app.services.product_service import ProductService


class OfferService:
    def __init__(self, db: AsyncSession) -> None:
        self.products = ProductService(db)

    async def compare_for_product(self, product_id: int):
        offers = await self.products.get_offers(product_id)
        history = await self.products.get_price_history([offer.id for offer in offers])
        return {"product_id": product_id, "offers": offers, "history": history}
