from __future__ import annotations

from sqlalchemy import Select, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models import (
    Brand,
    Category,
    PriceHistory,
    Product,
    ProductImage,
    ProductNote,
    ProductOffer,
)


class ProductService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def get_by_slug(self, slug: str) -> Product | None:
        result = await self.db.execute(self._detail_query().where(Product.slug == slug))
        return result.scalar_one_or_none()

    async def get_by_id(self, product_id: int) -> Product | None:
        result = await self.db.execute(self._detail_query().where(Product.id == product_id))
        return result.scalar_one_or_none()

    async def get_offers(self, product_id: int) -> list[ProductOffer]:
        result = await self.db.execute(
            select(ProductOffer)
            .options(selectinload(ProductOffer.retailer), selectinload(ProductOffer.store))
            .where(ProductOffer.product_id == product_id)
            .order_by(ProductOffer.in_stock.desc(), ProductOffer.price.asc())
        )
        return list(result.scalars().all())

    async def get_price_history(self, offer_ids: list[int], limit_per_offer: int = 90) -> dict[int, list[PriceHistory]]:
        if not offer_ids:
            return {}
        result = await self.db.execute(
            select(PriceHistory)
            .where(PriceHistory.product_offer_id.in_(offer_ids))
            .order_by(PriceHistory.product_offer_id, PriceHistory.recorded_at.desc())
        )
        grouped: dict[int, list[PriceHistory]] = {offer_id: [] for offer_id in offer_ids}
        for point in result.scalars().all():
            points = grouped.setdefault(point.product_offer_id, [])
            if len(points) < limit_per_offer:
                points.append(point)
        for points in grouped.values():
            points.reverse()
        return grouped

    async def merge_products(self, canonical_product_id: int, duplicate_product_id: int) -> None:
        await self.db.execute(
            ProductOffer.__table__.update()
            .where(ProductOffer.product_id == duplicate_product_id)
            .values(product_id=canonical_product_id)
        )
        await self.db.execute(
            ProductImage.__table__.update()
            .where(ProductImage.product_id == duplicate_product_id)
            .values(product_id=canonical_product_id)
        )
        await self.db.execute(
            ProductNote.__table__.update()
            .where(ProductNote.product_id == duplicate_product_id)
            .values(product_id=canonical_product_id)
        )
        await self.db.execute(Product.__table__.delete().where(Product.id == duplicate_product_id))
        await self.db.commit()

    def _detail_query(self) -> Select[tuple[Product]]:
        return (
            select(Product)
            .options(
                selectinload(Product.brand),
                selectinload(Product.category),
                selectinload(Product.images),
                selectinload(Product.aliases),
                selectinload(Product.notes).selectinload(ProductNote.fragrance_note),
                selectinload(Product.offers).selectinload(ProductOffer.retailer),
                selectinload(Product.offers).selectinload(ProductOffer.store),
            )
        )


async def product_summary_rows(db: AsyncSession, product_ids: list[int]) -> list[dict]:
    if not product_ids:
        return []
    lowest_price = func.min(ProductOffer.price).label("lowest_price")
    highest_discount = func.max(ProductOffer.discount_percent).label("highest_discount")
    result = await db.execute(
        select(Product, Brand, Category, lowest_price, highest_discount)
        .join(Brand, Brand.id == Product.brand_id)
        .join(Category, Category.id == Product.category_id)
        .outerjoin(ProductOffer, ProductOffer.product_id == Product.id)
        .where(Product.id.in_(product_ids))
        .group_by(Product.id, Brand.id, Category.id)
    )
    by_id = {
        product.id: {
            **product.__dict__,
            "brand": brand,
            "category": category,
            "lowest_price": price,
            "highest_discount": discount,
        }
        for product, brand, category, price, discount in result.all()
    }
    return [by_id[product_id] for product_id in product_ids if product_id in by_id]
