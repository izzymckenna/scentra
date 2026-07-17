from __future__ import annotations

from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.cache.redis_client import Cache
from app.models import Deal, Product, ProductOffer, Retailer


class DealService:
    def __init__(self, db: AsyncSession, cache: Cache | None = None) -> None:
        self.db = db
        self.cache = cache or Cache()

    async def best_deals(self, limit: int = 50) -> list[Deal]:
        result = await self.db.execute(
            select(Deal)
            .options(
                selectinload(Deal.product).selectinload(Product.brand),
                selectinload(Deal.product).selectinload(Product.category),
                selectinload(Deal.offer).selectinload(ProductOffer.retailer),
                selectinload(Deal.offer).selectinload(ProductOffer.store),
            )
            .where(Deal.is_active.is_(True))
            .order_by(Deal.deal_score.desc(), Deal.discount_percent.desc())
            .limit(limit)
        )
        return list(result.scalars().all())

    def score(
        self,
        discount_percent: Decimal,
        savings_amount: Decimal,
        product_popularity: Decimal,
        retailer_confidence: Decimal,
        freshness_score: Decimal,
    ) -> Decimal:
        savings_normalized = min(savings_amount / Decimal("100.00"), Decimal("1.00"))
        return (
            discount_percent * Decimal("0.45")
            + savings_normalized * Decimal("100") * Decimal("0.25")
            + product_popularity * Decimal("0.15")
            + retailer_confidence * Decimal("100") * Decimal("0.10")
            + freshness_score * Decimal("100") * Decimal("0.05")
        )

    async def recalculate_active_deals(self) -> int:
        result = await self.db.execute(
            select(ProductOffer, Product, Retailer)
            .join(Product, Product.id == ProductOffer.product_id)
            .join(Retailer, Retailer.id == ProductOffer.retailer_id)
            .where(ProductOffer.in_stock.is_(True), ProductOffer.discount_percent > 0)
        )
        changed = 0
        for offer, product, retailer in result.all():
            original = offer.original_price or offer.price
            savings = max(original - offer.price, Decimal("0.00"))
            deal_score = self.score(
                offer.discount_percent,
                savings,
                product.popularity_score,
                retailer.confidence_score,
                Decimal("1.00"),
            )
            existing = await self.db.scalar(select(Deal).where(Deal.product_offer_id == offer.id))
            if existing:
                existing.deal_score = deal_score
                existing.discount_percent = offer.discount_percent
                existing.savings_amount = savings
                existing.is_active = True
            else:
                self.db.add(
                    Deal(
                        product_offer_id=offer.id,
                        product_id=offer.product_id,
                        deal_score=deal_score,
                        discount_percent=offer.discount_percent,
                        savings_amount=savings,
                        is_active=True,
                    )
                )
            changed += 1
        await self.db.commit()
        await self.cache.delete_pattern("scentra:deals:*")
        return changed
