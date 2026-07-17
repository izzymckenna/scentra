from __future__ import annotations

from datetime import datetime
from decimal import Decimal

from geoalchemy2 import Geography
from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    Enum,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.enums import Gender, NoteType


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(320), unique=True, index=True)
    name: Mapped[str | None] = mapped_column(String(200))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Brand(Base):
    __tablename__ = "brands"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(200), unique=True)
    slug: Mapped[str] = mapped_column(String(220), unique=True, index=True)
    logo_url: Mapped[str | None] = mapped_column(Text)

    products: Mapped[list["Product"]] = relationship(back_populates="brand")


class Category(Base):
    __tablename__ = "categories"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(160))
    slug: Mapped[str] = mapped_column(String(180), unique=True, index=True)
    parent_id: Mapped[int | None] = mapped_column(ForeignKey("categories.id", ondelete="SET NULL"))

    parent: Mapped["Category | None"] = relationship(remote_side=[id])
    products: Mapped[list["Product"]] = relationship(back_populates="category")


class Product(Base):
    __tablename__ = "products"

    id: Mapped[int] = mapped_column(primary_key=True)
    brand_id: Mapped[int] = mapped_column(ForeignKey("brands.id"), index=True)
    category_id: Mapped[int] = mapped_column(ForeignKey("categories.id"), index=True)
    name: Mapped[str] = mapped_column(String(260))
    slug: Mapped[str] = mapped_column(String(300), unique=True, index=True)
    description: Mapped[str | None] = mapped_column(Text)
    gender: Mapped[Gender | None] = mapped_column(Enum(Gender, name="gender"))
    size: Mapped[str | None] = mapped_column(String(80))
    concentration: Mapped[str | None] = mapped_column(String(80))
    product_type: Mapped[str] = mapped_column(String(120), index=True)
    normalized_name: Mapped[str] = mapped_column(String(320), index=True)
    image_url: Mapped[str | None] = mapped_column(Text)
    rating: Mapped[Decimal | None] = mapped_column(Numeric(3, 2))
    review_count: Mapped[int] = mapped_column(Integer, default=0)
    popularity_score: Mapped[Decimal] = mapped_column(Numeric(8, 4), default=0)
    barcode: Mapped[str | None] = mapped_column(String(64), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    brand: Mapped[Brand] = relationship(back_populates="products")
    category: Mapped[Category] = relationship(back_populates="products")
    notes: Mapped[list["ProductNote"]] = relationship(back_populates="product")
    offers: Mapped[list["ProductOffer"]] = relationship(back_populates="product")
    aliases: Mapped[list["ProductAlias"]] = relationship(back_populates="product")
    images: Mapped[list["ProductImage"]] = relationship(back_populates="product")

    __table_args__ = (
        Index("ix_products_brand_category", "brand_id", "category_id"),
        Index("ix_products_rating", "rating"),
    )


class FragranceNote(Base):
    __tablename__ = "fragrance_notes"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(160), unique=True)
    slug: Mapped[str] = mapped_column(String(180), unique=True, index=True)
    note_family: Mapped[str | None] = mapped_column(String(120), index=True)


class ProductNote(Base):
    __tablename__ = "product_notes"

    product_id: Mapped[int] = mapped_column(ForeignKey("products.id", ondelete="CASCADE"), primary_key=True)
    fragrance_note_id: Mapped[int] = mapped_column(
        ForeignKey("fragrance_notes.id", ondelete="CASCADE"), primary_key=True
    )
    note_type: Mapped[NoteType] = mapped_column(Enum(NoteType, name="note_type"), primary_key=True)

    product: Mapped[Product] = relationship(back_populates="notes")
    fragrance_note: Mapped[FragranceNote] = relationship()


class Retailer(Base):
    __tablename__ = "retailers"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(180), unique=True)
    slug: Mapped[str] = mapped_column(String(200), unique=True, index=True)
    website_url: Mapped[str] = mapped_column(Text)
    logo_url: Mapped[str | None] = mapped_column(Text)
    nz_business_number: Mapped[str | None] = mapped_column(String(32))
    confidence_score: Mapped[Decimal] = mapped_column(Numeric(5, 4), default=0.8)
    approved: Mapped[bool] = mapped_column(Boolean, default=False, index=True)

    stores: Mapped[list["Store"]] = relationship(back_populates="retailer")


class Store(Base):
    __tablename__ = "stores"

    id: Mapped[int] = mapped_column(primary_key=True)
    retailer_id: Mapped[int] = mapped_column(ForeignKey("retailers.id"), index=True)
    name: Mapped[str] = mapped_column(String(220))
    address: Mapped[str] = mapped_column(Text)
    suburb: Mapped[str | None] = mapped_column(String(120), index=True)
    city: Mapped[str] = mapped_column(String(120), index=True)
    region: Mapped[str] = mapped_column(String(120), index=True)
    postcode: Mapped[str] = mapped_column(String(12), index=True)
    country_code: Mapped[str] = mapped_column(String(2), default="NZ", index=True)
    latitude: Mapped[Decimal] = mapped_column(Numeric(9, 6))
    longitude: Mapped[Decimal] = mapped_column(Numeric(9, 6))
    location = mapped_column(Geography(geometry_type="POINT", srid=4326, spatial_index=True))
    opening_hours: Mapped[dict | None] = mapped_column(JSONB)

    retailer: Mapped[Retailer] = relationship(back_populates="stores")

    __table_args__ = (
        Index("ix_stores_location_gist", "location", postgresql_using="gist"),
        CheckConstraint("country_code = 'NZ'", name="ck_stores_country_nz"),
    )


class ProductOffer(Base):
    __tablename__ = "product_offers"

    id: Mapped[int] = mapped_column(primary_key=True)
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id"), index=True)
    retailer_id: Mapped[int] = mapped_column(ForeignKey("retailers.id"), index=True)
    store_id: Mapped[int | None] = mapped_column(ForeignKey("stores.id"), index=True)
    retailer_sku: Mapped[str | None] = mapped_column(String(120))
    retailer_product_url: Mapped[str] = mapped_column(Text)
    price: Mapped[Decimal] = mapped_column(Numeric(12, 2), index=True)
    original_price: Mapped[Decimal | None] = mapped_column(Numeric(12, 2))
    currency: Mapped[str] = mapped_column(String(3), default="NZD", index=True)
    discount_percent: Mapped[Decimal] = mapped_column(Numeric(6, 2), default=0, index=True)
    in_stock: Mapped[bool] = mapped_column(Boolean, default=True, index=True)
    delivery_available: Mapped[bool] = mapped_column(Boolean, default=True)
    click_collect_available: Mapped[bool] = mapped_column(Boolean, default=False)
    last_seen_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    product: Mapped[Product] = relationship(back_populates="offers")
    retailer: Mapped[Retailer] = relationship()
    store: Mapped[Store | None] = relationship()

    __table_args__ = (
        UniqueConstraint("retailer_id", "retailer_sku", "store_id", name="uq_offer_retailer_sku_store"),
        Index("ix_product_offers_product_price", "product_id", "price"),
        Index("ix_product_offers_deal_lookup", "discount_percent", "in_stock", "updated_at"),
    )


class PriceHistory(Base):
    __tablename__ = "price_history"

    id: Mapped[int] = mapped_column(primary_key=True)
    product_offer_id: Mapped[int] = mapped_column(ForeignKey("product_offers.id"), index=True)
    price: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    original_price: Mapped[Decimal | None] = mapped_column(Numeric(12, 2))
    discount_percent: Mapped[Decimal] = mapped_column(Numeric(6, 2), default=0)
    recorded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        Index("ix_price_history_offer_recorded", "product_offer_id", "recorded_at"),
        Index("ix_price_history_recorded", "recorded_at"),
    )


class Deal(Base):
    __tablename__ = "deals"

    id: Mapped[int] = mapped_column(primary_key=True)
    product_offer_id: Mapped[int] = mapped_column(ForeignKey("product_offers.id"), index=True)
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id"), index=True)
    deal_score: Mapped[Decimal] = mapped_column(Numeric(8, 4), index=True)
    discount_percent: Mapped[Decimal] = mapped_column(Numeric(6, 2), index=True)
    savings_amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0)
    starts_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    ends_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), index=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, index=True)

    offer: Mapped[ProductOffer] = relationship()
    product: Mapped[Product] = relationship()

    __table_args__ = (Index("ix_deals_active_score", "is_active", "deal_score"),)


class ProductAlias(Base):
    __tablename__ = "product_aliases"

    id: Mapped[int] = mapped_column(primary_key=True)
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id", ondelete="CASCADE"), index=True)
    alias_name: Mapped[str] = mapped_column(String(320), index=True)
    source: Mapped[str] = mapped_column(String(120))

    product: Mapped[Product] = relationship(back_populates="aliases")


class ProductImage(Base):
    __tablename__ = "product_images"

    id: Mapped[int] = mapped_column(primary_key=True)
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id", ondelete="CASCADE"), index=True)
    image_url: Mapped[str] = mapped_column(Text)
    alt_text: Mapped[str | None] = mapped_column(String(260))
    position: Mapped[int] = mapped_column(Integer, default=0)
    source: Mapped[str | None] = mapped_column(String(120))

    product: Mapped[Product] = relationship(back_populates="images")
