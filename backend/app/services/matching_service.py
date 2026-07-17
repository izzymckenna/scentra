from __future__ import annotations

from dataclasses import dataclass
from difflib import SequenceMatcher

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Brand, Product
from app.utils.normalization import normalize_product_name


@dataclass
class ProductCandidate:
    brand_name: str
    product_name: str
    category_slug: str
    size: str | None = None
    barcode: str | None = None


@dataclass
class MatchResult:
    product: Product | None
    confidence: float
    reason: str


class MatchingService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def match_product(self, candidate: ProductCandidate) -> MatchResult:
        if candidate.barcode:
            product = await self.db.scalar(select(Product).where(Product.barcode == candidate.barcode))
            if product:
                return MatchResult(product=product, confidence=0.99, reason="barcode")

        brand = await self.db.scalar(
            select(Brand).where(Brand.name.ilike(candidate.brand_name), Brand.products.any())
        )
        if not brand:
            return MatchResult(product=None, confidence=0.0, reason="brand_not_found")

        normalized = normalize_product_name(candidate.product_name, candidate.brand_name)
        exact = await self.db.scalar(
            select(Product).where(
                Product.brand_id == brand.id,
                Product.normalized_name == normalized,
                Product.size == candidate.size,
            )
        )
        if exact:
            return MatchResult(product=exact, confidence=0.95, reason="brand_name_size")

        result = await self.db.execute(select(Product).where(Product.brand_id == brand.id).limit(100))
        best_product: Product | None = None
        best_score = 0.0
        for product in result.scalars().all():
            score = SequenceMatcher(None, normalized, product.normalized_name).ratio()
            if candidate.size and product.size == candidate.size:
                score += 0.08
            if score > best_score:
                best_product = product
                best_score = score

        if best_product and best_score >= 0.86:
            return MatchResult(product=best_product, confidence=min(best_score, 0.94), reason="fuzzy")
        return MatchResult(product=None, confidence=best_score, reason="needs_review")
