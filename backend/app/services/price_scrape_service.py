from __future__ import annotations

import asyncio
import json
from html.parser import HTMLParser
from typing import Any
from urllib.parse import urlparse

import httpx

from app.importers.live_retailers import (
    USER_AGENT,
    ProductJsonLdParser,
    clean_text,
    infer_brand,
    parse_money_or_none,
)
from app.utils.normalization import extract_size


class PageMetadataParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.meta: dict[str, str] = {}
        self.title: str | None = None
        self._in_title = False
        self._title_chunks: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        attr_map = dict(attrs)
        if tag == "meta":
            key = attr_map.get("property") or attr_map.get("name")
            content = attr_map.get("content")
            if key and content:
                self.meta[key.lower()] = content.strip()
        elif tag == "title":
            self._in_title = True
            self._title_chunks = []

    def handle_data(self, data: str) -> None:
        if self._in_title:
            self._title_chunks.append(data)

    def handle_endtag(self, tag: str) -> None:
        if tag == "title" and self._in_title:
            self.title = "".join(self._title_chunks).strip() or None
            self._in_title = False


class PriceScrapeService:
    def __init__(self, client: httpx.AsyncClient | None = None) -> None:
        self.client = client or httpx.AsyncClient(
            timeout=30,
            follow_redirects=True,
            headers={
                "Accept": "application/json,text/html;q=0.9,*/*;q=0.8",
                "User-Agent": USER_AGENT,
            },
        )

    async def scrape_urls(self, urls: list[str], limit: int = 20) -> list[dict[str, Any]]:
        tasks = [self.scrape_url(url) for url in urls[:limit]]
        results = await asyncio.gather(*tasks, return_exceptions=True)
        rows: list[dict[str, Any]] = []
        for url, result in zip(urls[:limit], results, strict=False):
            if isinstance(result, Exception):
                rows.append({"source_url": url, "status": "failed", "error": str(result)})
            else:
                rows.append(result)
        return rows

    async def scrape_url(self, url: str) -> dict[str, Any]:
        response = await self.client.get(url)
        response.raise_for_status()
        content_type = response.headers.get("content-type", "").lower()
        final_url = str(response.url)
        if "json" in content_type or final_url.endswith(".js"):
            payload = self._parse_json_payload(response.text)
            return self._row_from_payload(payload, final_url, source_url=url)

        html = response.text
        metadata = PageMetadataParser()
        metadata.feed(html)
        payload = ProductJsonLdParser().parse(html)
        return self._row_from_html(payload, metadata, final_url, source_url=url)

    def _parse_json_payload(self, raw: str) -> dict[str, Any] | list[Any] | Any:
        try:
            return json.loads(raw)
        except json.JSONDecodeError:
            return {}

    def _row_from_html(
        self,
        json_ld_products: list[dict[str, Any]],
        metadata: PageMetadataParser,
        final_url: str,
        *,
        source_url: str,
    ) -> dict[str, Any]:
        item = json_ld_products[0] if json_ld_products else {}
        meta = metadata.meta
        name = clean_text(
            item.get("name")
            or meta.get("og:title")
            or metadata.title
            or self._fallback_name(final_url)
        )
        offers = item.get("offers")
        offer = offers[0] if isinstance(offers, list) and offers else offers if isinstance(offers, dict) else {}
        price = parse_money_or_none(offer.get("price") or meta.get("product:price:amount") or meta.get("price"))
        currency = (
            offer.get("priceCurrency")
            or meta.get("product:price:currency")
            or meta.get("og:price:currency")
            or "NZD"
        )
        original_price = parse_money_or_none(
            meta.get("product:original_price:amount")
            or meta.get("original_price")
            or meta.get("compare_at_price")
        )
        image = (
            item.get("image")
            or meta.get("og:image")
            or meta.get("twitter:image")
            or meta.get("image")
        )
        if isinstance(image, list):
            image = image[0] if image else None
        description = item.get("description") or meta.get("og:description") or meta.get("description")
        brand = item.get("brand")
        if isinstance(brand, dict):
            brand = brand.get("name")
        brand_name = clean_text(str(brand)) if brand else None
        brand_name = brand_name or infer_brand(name or self._fallback_name(final_url))
        size = extract_size(f"{name or ''} {description or ''}") or extract_size(final_url)
        return {
            "status": "ok",
            "source_url": source_url,
            "final_url": final_url,
            "source_host": urlparse(final_url).hostname,
            "brand": brand_name,
            "name": name,
            "size": size,
            "price": str(price) if price is not None else None,
            "original_price": str(original_price) if original_price is not None else None,
            "currency": currency,
            "image_url": image,
            "description": clean_text(description) if description else None,
        }

    def _row_from_payload(
        self,
        payload: dict[str, Any] | list[Any] | Any,
        final_url: str,
        *,
        source_url: str,
    ) -> dict[str, Any]:
        product = self._extract_product_dict(payload)
        if product is None:
            return {
                "status": "failed",
                "source_url": source_url,
                "final_url": final_url,
                "error": "Could not find product data in JSON payload",
            }

        name = clean_text(
            str(product.get("title") or product.get("name") or self._fallback_name(final_url))
        )
        vendor = product.get("vendor") or product.get("brand")
        brand_name = clean_text(str(vendor)) if vendor else None
        brand_name = brand_name or infer_brand(name or self._fallback_name(final_url))
        price = parse_money_or_none(
            product.get("price")
            or self._first_variant_value(product, "price")
            or product.get("price_min")
        )
        original_price = parse_money_or_none(
            product.get("compare_at_price")
            or self._first_variant_value(product, "compare_at_price")
            or product.get("compare_at_price_max")
        )
        currency = (
            product.get("currency")
            or product.get("price_currency")
            or self._first_variant_value(product, "currency")
            or "NZD"
        )
        size = extract_size(f"{name or ''} {str(product.get('body') or product.get('description') or '')}")
        image = product.get("image") or product.get("featured_image")
        if isinstance(image, dict):
            image = image.get("src") or image.get("url")
        if isinstance(image, list):
            image = image[0] if image else None
        description = product.get("body") or product.get("description")
        return {
            "status": "ok",
            "source_url": source_url,
            "final_url": final_url,
            "source_host": urlparse(final_url).hostname,
            "brand": brand_name,
            "name": name,
            "size": size,
            "price": str(price) if price is not None else None,
            "original_price": str(original_price) if original_price is not None else None,
            "currency": currency,
            "image_url": image,
            "description": clean_text(description) if description else None,
        }

    def _extract_product_dict(self, payload: dict[str, Any] | list[Any] | Any) -> dict[str, Any] | None:
        candidates: list[dict[str, Any]] = []
        if isinstance(payload, dict):
            candidates.append(payload)
            product = payload.get("product")
            if isinstance(product, dict):
                candidates.append(product)
            if "variants" in payload:
                candidates.append(payload)
        elif isinstance(payload, list):
            for item in payload:
                if isinstance(item, dict):
                    candidates.append(item)
        for candidate in candidates:
            if candidate.get("@type") == "Product" or candidate.get("title") or candidate.get("name"):
                return candidate
        return None

    def _first_variant_value(self, product: dict[str, Any], key: str) -> Any:
        variants = product.get("variants")
        if isinstance(variants, list) and variants:
            first = variants[0]
            if isinstance(first, dict):
                return first.get(key)
        return None

    def _fallback_name(self, url: str) -> str:
        slug = urlparse(url).path.rstrip("/").split("/")[-1].replace("-", " ")
        return slug or "unknown product"
