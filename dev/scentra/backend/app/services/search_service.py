from __future__ import annotations

import hashlib
import json
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.cache.redis_client import Cache, cache_key
from app.schemas.filters import ExploreFilters
from app.search.meili import ProductSearchIndex
from app.services.product_service import product_summary_rows


class SearchService:
    def __init__(self, db: AsyncSession, cache: Cache | None = None, index: ProductSearchIndex | None = None) -> None:
        self.db = db
        self.cache = cache or Cache()
        self.index = index or ProductSearchIndex()

    async def product_search(self, query: str | None, page: int = 1, per_page: int = 20) -> dict[str, Any]:
        filters = ExploreFilters(q=query, page=page, per_page=per_page)
        return await self.explore(filters)

    async def explore(self, filters: ExploreFilters) -> dict[str, Any]:
        key = cache_key("explore", digest=self._digest(filters.model_dump()))
        cached = await self.cache.get_json(key)
        if cached is not None:
            cached["cached"] = True
            return cached

        params = self._meili_params(filters)
        response = await self.index.search(filters.q, params)
        hits = response.get("hits", [])
        product_ids = [int(hit["id"]) for hit in hits if "id" in hit]
        items = await product_summary_rows(self.db, product_ids)
        payload = {
            "items": items,
            "total": response.get("estimatedTotalHits", response.get("totalHits", len(items))),
            "facets": response.get("facetDistribution", {}),
            "cached": False,
        }
        await self.cache.set_json(key, payload)
        return payload

    def _meili_params(self, filters: ExploreFilters) -> dict[str, Any]:
        expressions: list[str] = []
        expressions.extend(f'category_slug = "{value}"' for value in filters.category)
        expressions.extend(f'brand_slug = "{value}"' for value in filters.brand)
        expressions.extend(f'note_slugs = "{value}"' for value in filters.notes)
        expressions.extend(f'product_type = "{value}"' for value in filters.product_type)
        expressions.extend(f'retailer_slugs = "{value}"' for value in filters.retailer)
        if filters.on_sale is not None:
            expressions.append(f"on_sale = {str(filters.on_sale).lower()}")
        if filters.in_stock is not None:
            expressions.append(f"in_stock = {str(filters.in_stock).lower()}")
        if filters.price_min is not None:
            expressions.append(f"lowest_price >= {filters.price_min}")
        if filters.price_max is not None:
            expressions.append(f"lowest_price <= {filters.price_max}")

        sort_map = {
            "price_asc": ["lowest_price:asc"],
            "price_desc": ["lowest_price:desc"],
            "deal_score": ["deal_score:desc"],
            "rating": ["rating:desc"],
            "newest": ["created_at:desc"],
            "popularity": ["popularity_score:desc"],
        }
        return {
            "page": filters.page,
            "hitsPerPage": filters.per_page,
            "filter": expressions,
            "facets": [
                "brand_slug",
                "category_slug",
                "note_slugs",
                "product_type",
                "retailer_slugs",
                "on_sale",
                "in_stock",
            ],
            "sort": sort_map.get(filters.sort, []),
        }

    def _digest(self, payload: dict[str, Any]) -> str:
        encoded = json.dumps(payload, sort_keys=True, default=str).encode()
        return hashlib.sha256(encoded).hexdigest()[:24]
