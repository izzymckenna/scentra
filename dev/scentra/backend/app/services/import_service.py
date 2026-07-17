from __future__ import annotations

from datetime import UTC, datetime
from decimal import Decimal
from typing import Any

from slugify import slugify
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Brand, Category, ImportRun, PriceHistory, Product, ProductMatchReview, ProductOffer
from app.models.enums import ImportStatus, MatchDecision
from app.services.deal_service import DealService
from app.services.matching_service import MatchingService, ProductCandidate
from app.utils.normalization import extract_concentration, extract_size, normalize_product_name, product_slug


class ImportService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db
        self.matcher = MatchingService(db)

    async def import_rows(
        self,
        retailer_id: int,
        source_name: str,
        rows: list[dict[str, Any]],
        dry_run: bool = False,
    ) -> ImportRun:
        run = ImportRun(
            retailer_id=retailer_id,
            source_name=source_name,
            status=ImportStatus.running,
            total_rows=len(rows),
        )
        self.db.add(run)
        await self.db.flush()

        try:
            for row in rows:
                await self._process_row(retailer_id, row, run, dry_run)
                run.processed_rows += 1
            run.status = ImportStatus.completed
            run.finished_at = datetime.now(UTC)
            if not dry_run:
                await DealService(self.db).recalculate_active_deals()
            await self.db.commit()
        except Exception as exc:
            run.status = ImportStatus.failed
            run.error_message = str(exc)
            run.finished_at = datetime.now(UTC)
            await self.db.commit()
            raise
        return run

    async def _process_row(
        self,
        retailer_id: int,
        row: dict[str, Any],
        run: ImportRun,
        dry_run: bool,
    ) -> None:
        size = row.get("size") or extract_size(row["name"])
        candidate = ProductCandidate(
            brand_name=row["brand"],
            product_name=row["name"],
            category_slug=row["category"],
            size=size,
            barcode=row.get("barcode"),
        )
        match = await self.matcher.match_product(candidate)
        if match.product is None and match.confidence >= 0.70:
            self.db.add(
                ProductMatchReview(
                    import_run_id=run.id,
                    candidate_payload=row,
                    confidence=match.confidence,
                    decision=MatchDecision.pending,
                )
            )
            return

        product = match.product or await self._create_product(row, size)
        if dry_run:
            return
        await self._upsert_offer(retailer_id, product.id, row)

    async def _create_product(self, row: dict[str, Any], size: str | None) -> Product:
        brand = await self._get_or_create_brand(row["brand"])
        category = await self._get_or_create_category(row["category"])
        name = row["name"]
        product = Product(
            brand_id=brand.id,
            category_id=category.id,
            name=name,
            slug=product_slug(brand.name, name, size),
            description=row.get("description"),
            size=size,
            concentration=row.get("concentration") or extract_concentration(name),
            product_type=row.get("product_type") or category.slug,
            normalized_name=normalize_product_name(name, brand.name),
            image_url=row.get("image_url"),
            barcode=row.get("barcode"),
        )
        self.db.add(product)
        await self.db.flush()
        return product

    async def _upsert_offer(self, retailer_id: int, product_id: int, row: dict[str, Any]) -> ProductOffer:
        price = Decimal(str(row["price"]))
        original_price = Decimal(str(row.get("original_price") or row["price"]))
        discount_percent = Decimal("0")
        if original_price > price:
            discount_percent = ((original_price - price) / original_price * Decimal("100")).quantize(Decimal("0.01"))

        offer = await self.db.scalar(
            select(ProductOffer).where(
                ProductOffer.retailer_id == retailer_id,
                ProductOffer.retailer_sku == row.get("retailer_sku"),
                ProductOffer.store_id.is_(None),
            )
        )
        changed = offer is None or offer.price != price or offer.original_price != original_price
        if offer is None:
            offer = ProductOffer(
                product_id=product_id,
                retailer_id=retailer_id,
                retailer_sku=row.get("retailer_sku"),
                retailer_product_url=row["url"],
                price=price,
                original_price=original_price,
                currency=row.get("currency", "NZD"),
                discount_percent=discount_percent,
                in_stock=row.get("in_stock", True),
                delivery_available=row.get("delivery_available", True),
                click_collect_available=row.get("click_collect_available", False),
                last_seen_at=datetime.now(UTC),
            )
            self.db.add(offer)
            await self.db.flush()
        else:
            offer.product_id = product_id
            offer.price = price
            offer.original_price = original_price
            offer.discount_percent = discount_percent
            offer.in_stock = row.get("in_stock", True)
            offer.last_seen_at = datetime.now(UTC)

        if changed:
            self.db.add(
                PriceHistory(
                    product_offer_id=offer.id,
                    price=price,
                    original_price=original_price,
                    discount_percent=discount_percent,
                )
            )
        return offer

    async def _get_or_create_brand(self, name: str) -> Brand:
        brand = await self.db.scalar(select(Brand).where(Brand.name.ilike(name)))
        if brand:
            return brand
        brand = Brand(name=name, slug=slugify(name))
        self.db.add(brand)
        await self.db.flush()
        return brand

    async def _get_or_create_category(self, slug: str) -> Category:
        category = await self.db.scalar(select(Category).where(Category.slug == slugify(slug)))
        if category:
            return category
        category = Category(name=slug.replace("-", " ").title(), slug=slugify(slug))
        self.db.add(category)
        await self.db.flush()
        return category
