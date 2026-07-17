from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field, field_validator


SortOption = Literal["relevance", "price_asc", "price_desc", "deal_score", "rating", "newest", "popularity"]


class ExploreFilters(BaseModel):
    q: str | None = None
    category: list[str] = Field(default_factory=list)
    brand: list[str] = Field(default_factory=list)
    notes: list[str] = Field(default_factory=list)
    product_type: list[str] = Field(default_factory=list)
    price_min: float | None = None
    price_max: float | None = None
    retailer: list[str] = Field(default_factory=list)
    on_sale: bool | None = None
    in_stock: bool | None = None
    latitude: float | None = None
    longitude: float | None = None
    radius_km: float | None = None
    sort: SortOption = "relevance"
    page: int = 1
    per_page: int = 24

    @field_validator("category", "brand", "notes", "product_type", "retailer", mode="before")
    @classmethod
    def split_csv(cls, value: str | list[str] | None) -> list[str]:
        if value is None or value == "":
            return []
        if isinstance(value, str):
            return [part.strip() for part in value.split(",") if part.strip()]
        return value


class NearbyStoreQuery(BaseModel):
    latitude: float
    longitude: float
    radius_km: float = 20
    retailer: list[str] = Field(default_factory=list)

    @field_validator("retailer", mode="before")
    @classmethod
    def split_retailers(cls, value: str | list[str] | None) -> list[str]:
        if value is None or value == "":
            return []
        if isinstance(value, str):
            return [part.strip() for part in value.split(",") if part.strip()]
        return value
