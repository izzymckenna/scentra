from __future__ import annotations

from typing import Any

import meilisearch

from app.core.config import get_settings


class ProductSearchIndex:
    filterable_attributes = [
        "brand_slug",
        "category_slug",
        "note_slugs",
        "product_type",
        "retailer_slugs",
        "on_sale",
        "in_stock",
    ]
    sortable_attributes = [
        "lowest_price",
        "highest_discount",
        "deal_score",
        "rating",
        "created_at",
        "popularity_score",
    ]
    searchable_attributes = [
        "name",
        "brand_name",
        "category_name",
        "note_names",
        "aliases",
        "description",
        "size",
        "concentration",
    ]

    def __init__(self) -> None:
        settings = get_settings()
        self.client = meilisearch.Client(settings.meilisearch_url, settings.meilisearch_api_key)
        self.index = self.client.index(settings.search_index_products)

    async def configure(self) -> None:
        self.index.update_filterable_attributes(self.filterable_attributes)
        self.index.update_sortable_attributes(self.sortable_attributes)
        self.index.update_searchable_attributes(self.searchable_attributes)
        self.index.update_typo_tolerance({"enabled": True})
        self.index.update_synonyms(
            {
                "perfume": ["fragrance", "parfum", "eau de parfum", "edp"],
                "cologne": ["eau de toilette", "edt", "fragrance"],
                "foundation": ["makeup base"],
            }
        )

    async def search(self, query: str | None, params: dict[str, Any]) -> dict[str, Any]:
        return self.index.search(query or "", params)

    async def upsert_products(self, documents: list[dict[str, Any]]) -> None:
        if documents:
            self.index.add_documents(documents, primary_key="id")

    async def delete_product(self, product_id: int) -> None:
        self.index.delete_document(product_id)
