from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import Any

from pydantic import BaseModel, Field


class BrandOut(BaseModel):
    id: int
    name: str
    slug: str
    logo_url: str | None = None

    model_config = {"from_attributes": True}


class CategoryOut(BaseModel):
    id: int
    name: str
    slug: str
    parent_id: int | None = None

    model_config = {"from_attributes": True}


class NoteOut(BaseModel):
    id: int
    name: str
    slug: str
    note_family: str | None = None
    note_type: str | None = None


class ProductImageOut(BaseModel):
    id: int
    image_url: str
    alt_text: str | None = None
    position: int

    model_config = {"from_attributes": True}


class RetailerOut(BaseModel):
    id: int
    name: str
    slug: str
    website_url: str
    logo_url: str | None = None

    model_config = {"from_attributes": True}


class StoreOut(BaseModel):
    id: int
    retailer_id: int
    name: str
    address: str
    suburb: str | None = None
    city: str
    region: str
    postcode: str
    latitude: Decimal
    longitude: Decimal
    opening_hours: dict[str, Any] | None = None
    distance_km: float | None = None

    model_config = {"from_attributes": True}


class OfferOut(BaseModel):
    id: int
    product_id: int
    retailer_id: int
    store_id: int | None = None
    retailer_product_url: str
    price: Decimal
    original_price: Decimal | None = None
    currency: str = "NZD"
    discount_percent: Decimal
    in_stock: bool
    delivery_available: bool
    click_collect_available: bool
    last_seen_at: datetime
    retailer: RetailerOut | None = None
    store: StoreOut | None = None

    model_config = {"from_attributes": True}


class ProductSummaryOut(BaseModel):
    id: int
    brand_id: int
    category_id: int
    name: str
    slug: str
    product_type: str
    size: str | None = None
    concentration: str | None = None
    image_url: str | None = None
    rating: Decimal | None = None
    review_count: int
    lowest_price: Decimal | None = None
    highest_discount: Decimal | None = None
    brand: BrandOut | None = None
    category: CategoryOut | None = None

    model_config = {"from_attributes": True}


class ProductDetailOut(ProductSummaryOut):
    description: str | None = None
    gender: str | None = None
    notes: list[NoteOut] = Field(default_factory=list)
    images: list[ProductImageOut] = Field(default_factory=list)
    offers: list[OfferOut] = Field(default_factory=list)


class DealOut(BaseModel):
    id: int
    product_offer_id: int
    product_id: int
    deal_score: Decimal
    discount_percent: Decimal
    savings_amount: Decimal
    starts_at: datetime | None = None
    ends_at: datetime | None = None
    is_active: bool
    product: ProductSummaryOut | None = None
    offer: OfferOut | None = None

    model_config = {"from_attributes": True}


class SearchResultOut(BaseModel):
    items: list[ProductSummaryOut | dict[str, Any]]
    total: int
    facets: dict[str, Any] = Field(default_factory=dict)
    cached: bool = False


class PricePointOut(BaseModel):
    price: Decimal
    original_price: Decimal | None = None
    discount_percent: Decimal
    recorded_at: datetime

    model_config = {"from_attributes": True}


class PriceComparisonOut(BaseModel):
    product_id: int
    offers: list[OfferOut]
    history: dict[int, list[PricePointOut]] = Field(default_factory=dict)
