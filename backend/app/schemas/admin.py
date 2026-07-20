from __future__ import annotations

from pydantic import BaseModel, HttpUrl


class ImportFeedRequest(BaseModel):
    retailer_id: int
    source_name: str
    feed_url: HttpUrl | None = None
    dry_run: bool = False


class LiveImportRequest(BaseModel):
    retailer_slugs: list[str] = ["life-pharmacy", "chemist-warehouse-nz", "lush", "farmers"]
    terms: list[str] | None = None
    limit_per_retailer: int = 100
    dry_run: bool = False


class LivePreviewRequest(BaseModel):
    retailer_slugs: list[str] = ["life-pharmacy", "chemist-warehouse-nz", "lush", "farmers"]
    terms: list[str] | None = None
    limit_per_retailer: int = 10


class PriceScrapeRequest(BaseModel):
    urls: list[HttpUrl]
    limit: int = 25


class PerfumeScrapeRequest(BaseModel):
    retailer_slugs: list[str] = ["life-pharmacy", "chemist-warehouse-nz", "healthpost", "the-warehouse"]
    terms: list[str] | None = None
    limit_per_retailer: int = 100


class MergeProductsRequest(BaseModel):
    canonical_product_id: int
    duplicate_product_id: int


class MatchDecisionRequest(BaseModel):
    matched_product_id: int | None = None
    decision: str
