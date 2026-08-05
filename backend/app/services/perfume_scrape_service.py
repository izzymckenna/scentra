from __future__ import annotations

from decimal import Decimal, InvalidOperation
from difflib import SequenceMatcher
from typing import Any

from app.importers import live_importer_for_slug
from app.importers.live_retailers import PERFUME_TERMS, clean_text, parse_money_or_none
from app.utils.normalization import extract_size, normalize_product_name, size_to_ml


class PerfumeScrapeService:
    def _normalized_brand(self, value: str | None) -> str:
        return normalize_product_name(clean_text(value or "") or "")

    def _normalized_name(self, name: str, brand: str) -> str:
        return normalize_product_name(name, brand)

    def _row_key(self, row: dict[str, Any]) -> str:
        brand = clean_text(str(row.get("brand") or "")) or ""
        name = clean_text(str(row.get("name") or "")) or ""
        size = clean_text(str(row.get("size") or "")) or extract_size(f"{name} {row.get('description') or ''} {row.get('url') or ''}") or ""
        normalized_name = self._normalized_name(name, brand)
        return "|".join(part for part in [self._normalized_brand(brand), normalized_name, size.lower()] if part)

    def _match_key(self, grouped: dict[str, dict[str, Any]], row: dict[str, Any]) -> str:
        exact_key = self._row_key(row)
        if exact_key in grouped:
            return exact_key

        brand = self._normalized_brand(str(row.get("brand") or ""))
        name = self._normalized_name(str(row.get("name") or ""), str(row.get("brand") or ""))
        size = clean_text(str(row.get("size") or "")) or ""
        best_key = exact_key
        best_score = 0.0

        for key, entry in grouped.items():
            if self._normalized_brand(str(entry.get("brand") or "")) != brand:
                continue
            if (entry.get("size") or "") != size:
                continue
            candidate_name = self._normalized_name(str(entry.get("name") or ""), str(entry.get("brand") or ""))
            score = SequenceMatcher(None, name, candidate_name).ratio()
            if score > best_score:
                best_key = key
                best_score = score

        return best_key if best_score >= 0.9 else exact_key

    def _price_decimal(self, value: Any) -> Decimal | None:
        price = parse_money_or_none(value)
        if price is None:
            return None
        try:
            return price.quantize(Decimal("0.01"))
        except (InvalidOperation, ValueError):
            return None

    def _price_per_100ml(self, price: Decimal | None, size: str | None) -> Decimal | None:
        ml = size_to_ml(size)
        if price is None or ml in (None, 0):
            return None
        return (price / ml * Decimal("100")).quantize(Decimal("0.01"))

    async def scrape(
        self,
        retailer_slugs: list[str],
        terms: list[str] | None = None,
        limit_per_retailer: int = 100,
    ) -> dict[str, Any]:
        grouped: dict[str, dict[str, Any]] = {}
        errors: list[dict[str, Any]] = []
        search_terms = terms or PERFUME_TERMS

        for slug in retailer_slugs:
            importer = live_importer_for_slug(slug)
            try:
                rows = await importer.fetch_rows(terms=search_terms, limit=limit_per_retailer)
            except Exception as exc:
                errors.append({"retailer_slug": slug, "error": str(exc)})
                continue
            for row in rows:
                name = clean_text(str(row.get("name") or ""))
                brand = clean_text(str(row.get("brand") or ""))
                if not name or not brand:
                    continue
                size = clean_text(str(row.get("size") or "")) or extract_size(f"{name} {row.get('description') or ''} {row.get('url') or ''}")
                key = self._match_key(grouped, {**row, "size": size})
                price = self._price_decimal(row.get("price"))
                source_price = self._price_decimal(row.get("original_price") or row.get("price"))
                source = {
                    "retailer_slug": slug,
                    "source_name": importer.source_name,
                    "source_url": row.get("url"),
                    "brand": brand,
                    "name": name,
                    "size": size,
                    "price": float(price) if price is not None else None,
                    "currency": row.get("currency") or "NZD",
                    "image_url": row.get("image_url"),
                }

                if key not in grouped:
                    grouped[key] = {
                        "brand": brand,
                        "name": name,
                        "size": size,
                        "size_ml": float(size_to_ml(size)) if size_to_ml(size) is not None else None,
                        "price": float(price) if price is not None else None,
                        "price_per_100ml": float(self._price_per_100ml(price, size)) if self._price_per_100ml(price, size) is not None else None,
                        "currency": row.get("currency") or "NZD",
                        "image_url": row.get("image_url"),
                        "description": row.get("description"),
                        "source_name": importer.source_name,
                        "source_url": row.get("url"),
                        "source_price": float(source_price) if source_price is not None else None,
                        "source_count": 1,
                        "sources": [source],
                    }
                    continue

                entry = grouped[key]
                entry["source_count"] += 1
                entry["sources"].append(source)

                current_price = self._price_decimal(entry.get("price"))
                if price is not None and (current_price is None or price < current_price):
                    entry["price"] = float(price)
                    entry["price_per_100ml"] = (
                        float(self._price_per_100ml(price, size)) if self._price_per_100ml(price, size) is not None else entry.get("price_per_100ml")
                    )
                    entry["currency"] = row.get("currency") or entry.get("currency") or "NZD"
                    entry["image_url"] = row.get("image_url") or entry.get("image_url")
                    entry["description"] = row.get("description") or entry.get("description")
                    entry["source_name"] = importer.source_name
                    entry["source_url"] = row.get("url")
                    entry["source_price"] = float(source_price) if source_price is not None else entry.get("source_price")
                    entry["size_ml"] = float(size_to_ml(size)) if size_to_ml(size) is not None else entry.get("size_ml")

        results = list(grouped.values())
        results.sort(
            key=lambda item: (
                item.get("price_per_100ml") is None,
                item.get("price_per_100ml") or 0,
                item.get("price") is None,
                item.get("price") or 0,
                item.get("brand") or "",
                item.get("name") or "",
            )
        )
        return {
            "count": len(results),
            "cheapest": results[0] if results else None,
            "results": results,
            "errors": errors,
        }
