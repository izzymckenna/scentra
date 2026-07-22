from __future__ import annotations

import asyncio
import html
import json
import re
from abc import ABC, abstractmethod
from decimal import Decimal, InvalidOperation
from html.parser import HTMLParser
from typing import Any
from urllib.parse import urljoin

import httpx

from app.utils.normalization import extract_size


DEFAULT_TERMS = ["perfume", "fragrance", "skincare", "makeup", "haircare", "beauty"]
PERFUME_TERMS = [
    "perfume",
    "fragrance",
    "eau de parfum",
    "eau de toilette",
    "parfum",
    "edp",
    "edt",
    "body mist",
    "perfume mist",
    "cologne",
    "extrait",
]
DEFAULT_PERFUME_RETAILERS = [
    "life-pharmacy",
    "chemist-warehouse-nz",
    "healthpost",
    "the-warehouse",
    "brand-outlet",
    "perfume-nz",
    "scent-boutique",
    "miller-road",
]
USER_AGENT = "ScentraBot/0.1 (+https://scentra.local; price comparison import)"
PERFUME_INCLUDE_RE = re.compile(r"\b(perfume|fragrance|parfum|eau de parfum|eau de toilette|edp|edt|body mist|perfume mist|cologne|extrait)\b", re.IGNORECASE)
PERFUME_EXCLUDE_RE = re.compile(
    r"\b(atomiser|atomizer|accessory|case|travel spray|sample|tester|refill|set|gift set|gift pack|"
    r"fragrance free|lotion|moisturiser|moisturizer|cream|soap|body wash|shampoo|conditioner|workshop|"
    r"deodorant|candle|diffuser)\b",
    re.IGNORECASE,
)


class LiveRetailerImportError(RuntimeError):
    pass


class RetailerImporter(ABC):
    slug: str
    source_name: str
    base_url: str

    def __init__(self, client: httpx.AsyncClient | None = None) -> None:
        self.client = client or httpx.AsyncClient(
            timeout=30,
            follow_redirects=True,
            headers={
                "Accept": "application/json,text/html;q=0.9,*/*;q=0.8",
                "User-Agent": USER_AGENT,
            },
        )

    @abstractmethod
    async def fetch_rows(self, terms: list[str] | None = None, limit: int = 100) -> list[dict[str, Any]]:
        raise NotImplementedError

    def _row(
        self,
        *,
        name: str,
        brand: str | None,
        price: str | int | float | Decimal,
        url: str,
        category: str,
        original_price: str | int | float | Decimal | None = None,
        image_url: str | None = None,
        description: str | None = None,
        product_type: str | None = None,
        retailer_sku: str | None = None,
        in_stock: bool = True,
    ) -> dict[str, Any]:
        current_price = parse_money(price)
        was_price = parse_money(original_price) if original_price not in (None, "") else current_price
        return {
            "brand": clean_text(brand) or infer_brand(name),
            "name": clean_text(name),
            "category": category,
            "product_type": product_type or category,
            "size": extract_size(name),
            "price": str(current_price),
            "original_price": str(was_price),
            "currency": "NZD",
            "url": urljoin(self.base_url, url),
            "image_url": image_url,
            "description": clean_text(description) if description else None,
            "retailer_sku": retailer_sku,
            "in_stock": in_stock,
            "delivery_available": True,
            "click_collect_available": True,
        }

    async def _get_with_retry(
        self,
        url: str,
        *,
        params: dict[str, Any] | None = None,
        headers: dict[str, str] | None = None,
        attempts: int = 3,
    ) -> httpx.Response:
        last_response: httpx.Response | None = None
        for attempt in range(1, attempts + 1):
            response = await self.client.get(url, params=params, headers=headers)
            if response.status_code < 500:
                return response
            last_response = response
            if attempt < attempts:
                await asyncio.sleep(attempt)
        assert last_response is not None
        return last_response


class LifePharmacyImporter(RetailerImporter):
    slug = "life-pharmacy"
    source_name = "life-pharmacy-shopify-suggest"
    base_url = "https://www.lifepharmacy.co.nz"

    async def fetch_rows(self, terms: list[str] | None = None, limit: int = 100) -> list[dict[str, Any]]:
        rows: list[dict[str, Any]] = []
        seen: set[str] = set()
        for term in terms or DEFAULT_TERMS:
            try:
                response = await self._get_with_retry(
                    f"{self.base_url}/search/suggest.json",
                    params={
                        "q": term,
                        "resources[type]": "product",
                        "resources[limit]": min(limit, 50),
                    },
                )
                ensure_json_response(response, self.slug)
            except (httpx.HTTPError, LiveRetailerImportError):
                continue
            products = response.json().get("resources", {}).get("results", {}).get("products", [])
            for item in products:
                sku = str(item.get("id") or item.get("handle") or item.get("url"))
                if not sku or sku in seen:
                    continue
                seen.add(sku)
                if not is_perfume_row(item.get("title"), item.get("body"), item.get("type"), item.get("vendor"), item.get("tags")):
                    continue
                price = first_positive_money(
                    item.get("price_min"),
                    item.get("price"),
                    item.get("price_max"),
                )
                if not has_positive_money(price):
                    continue
                compare_at = first_positive_money(
                    item.get("compare_at_price_min"),
                    item.get("compare_at_price_max"),
                )
                rows.append(
                    self._row(
                        name=item["title"],
                        brand=item.get("vendor"),
                        price=price,
                        original_price=compare_at if parse_money_or_none(compare_at) else None,
                        url=item["url"],
                        category=category_from_type(item.get("type")),
                        product_type=item.get("type") or "beauty",
                        image_url=item.get("image") or item.get("featured_image", {}).get("url"),
                        description=item.get("body"),
                        retailer_sku=sku,
                        in_stock=bool(item.get("available", True)),
                    )
                )
                if len(rows) >= limit:
                    return rows
        return rows


class ChemistWarehouseImporter(RetailerImporter):
    slug = "chemist-warehouse-nz"
    source_name = "chemist-warehouse-search-suggest"
    base_url = "https://www.chemistwarehouse.co.nz"

    async def fetch_rows(self, terms: list[str] | None = None, limit: int = 100) -> list[dict[str, Any]]:
        rows: list[dict[str, Any]] = []
        seen: set[str] = set()
        for term in terms or DEFAULT_TERMS:
            try:
                response = await self._get_with_retry(
                    f"{self.base_url}/searchapiv2/suggest?&identifier=nz&search={term}",
                    headers={
                        "Referer": f"{self.base_url}/search?searchtext={term}",
                        "User-Agent": "Mozilla/5.0 ScentraBot/0.1",
                    },
                )
                ensure_json_response(response, self.slug)
            except (httpx.HTTPError, LiveRetailerImportError):
                continue
            groups = response.json().get("suggestionGroups", [])
            products = next((group.get("suggestions", []) for group in groups if group.get("indexName") == "3products"), [])
            for item in products:
                sku = str(item.get("secondId") or item.get("id") or item.get("producturl"))
                if not sku or sku in seen:
                    continue
                seen.add(sku)
                brand = item.get("brand")
                if brand and brand.lower().startswith("cw nz"):
                    brand = None
                price = item.get("price")
                if not has_positive_money(price):
                    continue
                rows.append(
                    self._row(
                        name=item["name"],
                        brand=brand,
                        price=price,
                        original_price=item.get("rrp"),
                        url=item["producturl"],
                        category=chemist_category(item),
                        product_type=chemist_category(item),
                        image_url=item.get("_thumburl"),
                        retailer_sku=sku,
                        in_stock=not bool(item.get("is_marketplace") == "1"),
                    )
                )
                if len(rows) >= limit:
                    return rows
        return rows


class HealthPostImporter(RetailerImporter):
    slug = "healthpost"
    source_name = "healthpost-shopify-suggest"
    base_url = "https://www.healthpost.co.nz"

    async def fetch_rows(self, terms: list[str] | None = None, limit: int = 100) -> list[dict[str, Any]]:
        rows: list[dict[str, Any]] = []
        seen: set[str] = set()
        for term in terms or PERFUME_TERMS:
            try:
                response = await self._get_with_retry(
                    f"{self.base_url}/search/suggest.json",
                    params={
                        "q": term,
                        "resources[type]": "product",
                        "resources[options][unavailable_products]": "last",
                        "resources[limit]": min(limit, 50),
                    },
                )
                ensure_json_response(response, self.slug)
            except (httpx.HTTPError, LiveRetailerImportError):
                continue
            products = response.json().get("resources", {}).get("results", {}).get("products", [])
            for item in products:
                sku = str(item.get("id") or item.get("handle") or item.get("url"))
                if not sku or sku in seen:
                    continue
                seen.add(sku)
                if not is_perfume_row(item.get("title"), item.get("body"), item.get("type"), item.get("vendor"), item.get("tags")):
                    continue
                price = first_positive_money(
                    item.get("price_min"),
                    item.get("price"),
                    item.get("price_max"),
                )
                if not has_positive_money(price):
                    continue
                compare_at = first_positive_money(
                    item.get("compare_at_price_min"),
                    item.get("compare_at_price_max"),
                )
                rows.append(
                    self._row(
                        name=item["title"],
                        brand=item.get("vendor"),
                        price=price,
                        original_price=compare_at if parse_money_or_none(compare_at) else None,
                        url=item["url"],
                        category=category_from_type(item.get("type")),
                        product_type=item.get("type") or "fragrance",
                        image_url=item.get("image") or item.get("featured_image", {}).get("url"),
                        description=strip_html(item.get("body")),
                        retailer_sku=sku,
                        in_stock=bool(item.get("available", True)),
                    )
                )
                if len(rows) >= limit:
                    return rows
        return rows


class TheWarehouseImporter(RetailerImporter):
    slug = "the-warehouse"
    source_name = "the-warehouse-fragrance-page"
    base_url = "https://www.thewarehouse.co.nz"

    async def fetch_rows(self, terms: list[str] | None = None, limit: int = 100) -> list[dict[str, Any]]:
        response = await self._get_with_retry(
            f"{self.base_url}/c/health-beauty/fragrances",
            params={"sr": "perfume", "sz": min(limit, 48)},
            headers={"User-Agent": "Mozilla/5.0 ScentraBot/0.1"},
        )
        if is_waf_deny(response.text):
            raise LiveRetailerImportError(f"{self.slug} returned a block/error page instead of product HTML.")
        response.raise_for_status()

        products = WarehouseProductTileParser().parse(response.text)
        rows: list[dict[str, Any]] = []
        seen: set[str] = set()
        for item in products:
            sku = str(item.get("id") or item.get("variationProductId") or item.get("url"))
            if not sku or sku in seen:
                continue
            seen.add(sku)
            if not is_perfume_row(item.get("name"), item.get("brand"), item.get("category")):
                continue
            price = item.get("price")
            if not has_positive_money(price):
                continue
            rows.append(
                self._row(
                    name=item["name"],
                    brand=item.get("brand"),
                    price=price,
                    original_price=item.get("productThenPrice") or price,
                    url=item.get("url") or f"/p/{sku}.html",
                    category="fragrance",
                    product_type="fragrance",
                    image_url=item.get("image_url"),
                    retailer_sku=sku,
                    in_stock=True,
                )
            )
            if len(rows) >= limit:
                return rows
        if not rows:
            raise LiveRetailerImportError("The Warehouse fragrance page returned no parseable product tiles.")
        return rows


class BrandOutletImporter(RetailerImporter):
    slug = "brand-outlet"
    source_name = "brand-outlet-shopify-suggest"
    base_url = "https://www.thebrandoutlet.co.nz"

    async def fetch_rows(self, terms: list[str] | None = None, limit: int = 100) -> list[dict[str, Any]]:
        rows: list[dict[str, Any]] = []
        seen: set[str] = set()
        for term in terms or PERFUME_TERMS:
            try:
                response = await self._get_with_retry(
                    f"{self.base_url}/search/suggest.json",
                    params={
                        "q": term,
                        "resources[type]": "product",
                        "resources[limit]": min(limit, 50),
                    },
                )
                ensure_json_response(response, self.slug)
            except (httpx.HTTPError, LiveRetailerImportError):
                continue
            products = response.json().get("resources", {}).get("results", {}).get("products", [])
            for item in products:
                sku = str(item.get("id") or item.get("handle") or item.get("url"))
                if not sku or sku in seen:
                    continue
                seen.add(sku)
                if not is_perfume_row(item.get("title"), item.get("body"), item.get("type"), item.get("vendor"), item.get("tags")):
                    continue
                price = first_positive_money(
                    item.get("price_min"),
                    item.get("price"),
                    item.get("price_max"),
                )
                if not has_positive_money(price):
                    continue
                compare_at = first_positive_money(
                    item.get("compare_at_price_min"),
                    item.get("compare_at_price_max"),
                )
                rows.append(
                    self._row(
                        name=item["title"],
                        brand=item.get("vendor"),
                        price=price,
                        original_price=compare_at if parse_money_or_none(compare_at) else None,
                        url=item["url"],
                        category=category_from_type(item.get("type")),
                        product_type=item.get("type") or "fragrance",
                        image_url=item.get("image") or item.get("featured_image", {}).get("url"),
                        description=strip_html(item.get("body")),
                        retailer_sku=sku,
                        in_stock=bool(item.get("available", True)),
                    )
                )
                if len(rows) >= limit:
                    return rows
        return rows


class PerfumeNZImporter(RetailerImporter):
    slug = "perfume-nz"
    source_name = "perfume-nz-shopify-suggest"
    base_url = "https://www.perfumenz.co.nz"

    async def fetch_rows(self, terms: list[str] | None = None, limit: int = 100) -> list[dict[str, Any]]:
        rows: list[dict[str, Any]] = []
        seen: set[str] = set()
        for term in terms or PERFUME_TERMS:
            try:
                response = await self._get_with_retry(
                    f"{self.base_url}/search/suggest.json",
                    params={
                        "q": term,
                        "resources[type]": "product",
                        "resources[limit]": min(limit, 50),
                    },
                )
                ensure_json_response(response, self.slug)
            except (httpx.HTTPError, LiveRetailerImportError):
                continue
            products = response.json().get("resources", {}).get("results", {}).get("products", [])
            for item in products:
                sku = str(item.get("id") or item.get("handle") or item.get("url"))
                if not sku or sku in seen:
                    continue
                seen.add(sku)
                if not is_perfume_row(item.get("title"), item.get("body"), item.get("type"), item.get("vendor"), item.get("tags")):
                    continue
                price = first_positive_money(
                    item.get("price_min"),
                    item.get("price"),
                    item.get("price_max"),
                )
                if not has_positive_money(price):
                    continue
                compare_at = first_positive_money(
                    item.get("compare_at_price_min"),
                    item.get("compare_at_price_max"),
                )
                rows.append(
                    self._row(
                        name=item["title"],
                        brand=item.get("vendor"),
                        price=price,
                        original_price=compare_at if parse_money_or_none(compare_at) else None,
                        url=item["url"],
                        category=category_from_type(item.get("type")),
                        product_type=item.get("type") or "fragrance",
                        image_url=item.get("image") or item.get("featured_image", {}).get("url"),
                        description=strip_html(item.get("body")),
                        retailer_sku=sku,
                        in_stock=bool(item.get("available", True)),
                    )
                )
                if len(rows) >= limit:
                    return rows
        return rows


class ShopifyPerfumeSuggestImporter(RetailerImporter):
    async def fetch_rows(self, terms: list[str] | None = None, limit: int = 100) -> list[dict[str, Any]]:
        rows: list[dict[str, Any]] = []
        seen: set[str] = set()
        for term in terms or PERFUME_TERMS:
            try:
                response = await self._get_with_retry(
                    f"{self.base_url}/search/suggest.json",
                    params={
                        "q": term,
                        "resources[type]": "product",
                        "resources[limit]": min(limit, 50),
                    },
                )
                ensure_json_response(response, self.slug)
            except (httpx.HTTPError, LiveRetailerImportError):
                continue
            products = response.json().get("resources", {}).get("results", {}).get("products", [])
            for item in products:
                sku = str(item.get("id") or item.get("handle") or item.get("url"))
                if not sku or sku in seen:
                    continue
                seen.add(sku)
                name = item.get("title") or item.get("name")
                if not name:
                    continue
                if not is_perfume_row(name, item.get("body"), item.get("type"), item.get("vendor"), item.get("tags")):
                    continue
                price = first_positive_money(
                    item.get("price_min"),
                    item.get("price"),
                    item.get("price_max"),
                )
                if not has_positive_money(price):
                    continue
                compare_at = first_positive_money(
                    item.get("compare_at_price_min"),
                    item.get("compare_at_price_max"),
                )
                rows.append(
                    self._row(
                        name=name,
                        brand=item.get("vendor"),
                        price=price,
                        original_price=compare_at if parse_money_or_none(compare_at) else None,
                        url=item.get("url") or f"/products/{item.get('handle')}",
                        category=category_from_type(item.get("type") or "fragrance"),
                        product_type=item.get("type") or "fragrance",
                        image_url=item.get("image") or item.get("featured_image", {}).get("url"),
                        description=strip_html(item.get("body")),
                        retailer_sku=sku,
                        in_stock=bool(item.get("available", True)),
                    )
                )
                if len(rows) >= limit:
                    return rows
        return rows


class ScentBoutiqueImporter(ShopifyPerfumeSuggestImporter):
    slug = "scent-boutique"
    source_name = "scent-boutique-shopify-suggest"
    base_url = "https://scentboutique.co.nz"


class MillerRoadImporter(ShopifyPerfumeSuggestImporter):
    slug = "miller-road"
    source_name = "miller-road-shopify-suggest"
    base_url = "https://millerroad.co.nz"


class LushImporter(RetailerImporter):
    slug = "lush"
    source_name = "lush-nz-search"
    base_url = "https://www.lush.com/nz"

    async def fetch_rows(self, terms: list[str] | None = None, limit: int = 100) -> list[dict[str, Any]]:
        rows: list[dict[str, Any]] = []
        seen: set[str] = set()
        for term in terms or PERFUME_TERMS:
            response = await self._get_with_retry(
                f"{self.base_url}/search/suggest.json",
                params={
                    "q": term,
                    "resources[type]": "product",
                    "resources[limit]": min(limit, 50),
                },
            )
            ensure_json_response(response, self.slug)
            products = response.json().get("resources", {}).get("results", {}).get("products", [])
            for item in products:
                sku = str(item.get("id") or item.get("handle") or item.get("url"))
                if not sku or sku in seen:
                    continue
                seen.add(sku)
                if not is_perfume_row(item.get("name"), item.get("description"), item.get("type"), item.get("brand"), item.get("l2_category")):
                    continue
                price = first_positive_money(
                    item.get("price_min"),
                    item.get("price"),
                    item.get("price_max"),
                )
                if not has_positive_money(price):
                    continue
                rows.append(
                    self._row(
                        name=item["title"],
                        brand=item.get("vendor"),
                        price=price,
                        original_price=first_positive_money(
                            item.get("compare_at_price_min"),
                            item.get("compare_at_price_max"),
                        ),
                        url=item["url"],
                        category="fragrance",
                        product_type=item.get("type") or "perfume",
                        image_url=item.get("featured_image", {}).get("url") or item.get("image"),
                        description=item.get("body"),
                        retailer_sku=sku,
                        in_stock=bool(item.get("available", True)),
                    )
                )
                if len(rows) >= limit:
                    return rows
        return rows


class FarmersImporter(RetailerImporter):
    slug = "farmers"
    source_name = "farmers-public-search"
    base_url = "https://www.farmers.co.nz"

    async def fetch_rows(self, terms: list[str] | None = None, limit: int = 100) -> list[dict[str, Any]]:
        rows: list[dict[str, Any]] = []
        seen: set[str] = set()
        for term in terms or DEFAULT_TERMS:
            response = await self._get_with_retry(f"{self.base_url}/search", params={"q": term})
            if is_waf_deny(response.text):
                raise LiveRetailerImportError(
                    "Farmers returned an upstream WAF deny page. Run from an allowed network, "
                    "or configure an approved Farmers feed URL for imports."
                )
            response.raise_for_status()
            products = ProductJsonLdParser().parse(response.text)
            for item in products:
                sku = str(item.get("sku") or item.get("url") or item.get("name"))
                if not sku or sku in seen or not item.get("offers"):
                    continue
                seen.add(sku)
                if not is_perfume_row(item.get("name"), item.get("description"), item.get("category"), item.get("brand")):
                    continue
                offer = item["offers"][0] if isinstance(item["offers"], list) else item["offers"]
                rows.append(
                    self._row(
                        name=item["name"],
                        brand=brand_from_jsonld(item.get("brand")),
                        price=offer.get("price"),
                        original_price=offer.get("price"),
                        url=item.get("url") or response.url.path,
                        category=category_from_type(item.get("category") or "beauty"),
                        product_type=item.get("category") or "beauty",
                        image_url=image_from_jsonld(item.get("image")),
                        description=item.get("description"),
                        retailer_sku=sku,
                        in_stock="instock" in str(offer.get("availability", "")).lower(),
                    )
                )
                if len(rows) >= limit:
                    return rows
        if not rows:
            raise LiveRetailerImportError("Farmers search returned no parseable product JSON-LD.")
        return rows


class ProductJsonLdParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self._in_json_ld = False
        self._chunks: list[str] = []
        self.products: list[dict[str, Any]] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag != "script":
            return
        attr_map = dict(attrs)
        self._in_json_ld = attr_map.get("type") == "application/ld+json"
        self._chunks = []

    def handle_data(self, data: str) -> None:
        if self._in_json_ld:
            self._chunks.append(data)

    def handle_endtag(self, tag: str) -> None:
        if tag == "script" and self._in_json_ld:
            self._collect_json_ld("".join(self._chunks))
            self._in_json_ld = False

    def parse(self, html: str) -> list[dict[str, Any]]:
        self.feed(html)
        return self.products

    def _collect_json_ld(self, raw: str) -> None:
        try:
            payload = json.loads(raw)
        except json.JSONDecodeError:
            return
        for item in flatten_json_ld(payload):
            if item.get("@type") == "Product" and item.get("name"):
                self.products.append(item)


class WarehouseProductTileParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.products: list[dict[str, Any]] = []
        self._current: dict[str, Any] | None = None
        self._depth = 0

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        attr_map = dict(attrs)
        classes = set((attr_map.get("class") or "").split())
        if self._current is None and tag == "div" and "product-tile" in classes:
            raw_product = attr_map.get("data-gtm-product")
            if not raw_product:
                return
            try:
                self._current = json.loads(html.unescape(raw_product))
            except json.JSONDecodeError:
                self._current = None
                return
            self._depth = 1
            return

        if self._current is None:
            return

        if tag == "div":
            self._depth += 1
        elif tag == "a" and not self._current.get("url") and attr_map.get("href"):
            self._current["url"] = attr_map["href"]
        elif tag == "img" and not self._current.get("image_url"):
            image_url = attr_map.get("src") or attr_map.get("data-src")
            if image_url and "product-badges" not in image_url:
                self._current["image_url"] = html.unescape(image_url)

    def handle_endtag(self, tag: str) -> None:
        if self._current is None or tag != "div":
            return
        self._depth -= 1
        if self._depth <= 0:
            self.products.append(self._current)
            self._current = None

    def parse(self, html_text: str) -> list[dict[str, Any]]:
        self.feed(html_text)
        return self.products


def live_importer_for_slug(slug: str) -> RetailerImporter:
    importers: dict[str, type[RetailerImporter]] = {
        LifePharmacyImporter.slug: LifePharmacyImporter,
        ChemistWarehouseImporter.slug: ChemistWarehouseImporter,
        HealthPostImporter.slug: HealthPostImporter,
        TheWarehouseImporter.slug: TheWarehouseImporter,
        BrandOutletImporter.slug: BrandOutletImporter,
        PerfumeNZImporter.slug: PerfumeNZImporter,
        ScentBoutiqueImporter.slug: ScentBoutiqueImporter,
        MillerRoadImporter.slug: MillerRoadImporter,
        LushImporter.slug: LushImporter,
        FarmersImporter.slug: FarmersImporter,
    }
    try:
        return importers[slug]()
    except KeyError as exc:
        raise LiveRetailerImportError(f"No live importer configured for retailer slug '{slug}'.") from exc


def ensure_json_response(response: httpx.Response, retailer_slug: str) -> None:
    response.raise_for_status()
    content_type = response.headers.get("content-type", "")
    if "json" not in content_type.lower():
        try:
            response.json()
            return
        except json.JSONDecodeError:
            pass
        if is_waf_deny(response.text) or "Something went wrong" in response.text:
            raise LiveRetailerImportError(f"{retailer_slug} returned a block/error page instead of product JSON.")
        raise LiveRetailerImportError(f"{retailer_slug} returned non-JSON content: {content_type}")


def is_waf_deny(html: str) -> bool:
    markers = ["WAF_Deny_Page", "temporarily down", "Error code:&#32;&#35;18", "Akamai"]
    return any(marker.lower() in html.lower() for marker in markers)


def parse_money(value: str | int | float | Decimal) -> Decimal:
    parsed = parse_money_or_none(value)
    if parsed is None:
        raise LiveRetailerImportError(f"Could not parse price value: {value!r}")
    return parsed


def parse_money_or_none(value: Any) -> Decimal | None:
    if value is None:
        return None
    try:
        cleaned = re.sub(r"[^0-9.]+", "", str(value))
        if not cleaned:
            return None
        return Decimal(cleaned).quantize(Decimal("0.01"))
    except (InvalidOperation, ValueError):
        return None


def first_positive_money(*values: Any) -> Any:
    for value in values:
        parsed = parse_money_or_none(value)
        if parsed is not None and parsed > 0:
            return value
    for value in values:
        if parse_money_or_none(value) is not None:
            return value
    return None


def has_positive_money(value: Any) -> bool:
    parsed = parse_money_or_none(value)
    return parsed is not None and parsed > 0


def clean_text(value: str | None) -> str | None:
    if value is None:
        return None
    return re.sub(r"\s+", " ", value).strip()


def strip_html(value: str | None) -> str | None:
    if value is None:
        return None
    without_tags = re.sub(r"<[^>]+>", " ", html.unescape(value))
    return clean_text(without_tags)


def infer_brand(name: str) -> str:
    words = clean_text(name).split(" ") if clean_text(name) else ["Unknown"]
    if len(words) >= 2 and words[0].lower() in {"yves", "estee", "calvin", "jimmy"}:
        return " ".join(words[:2])
    return words[0]


def category_from_type(value: str | None) -> str:
    normalized = (value or "beauty").lower()
    if "fragrance" in normalized or "perfume" in normalized or "cologne" in normalized:
        return "fragrance"
    if "skin" in normalized:
        return "skincare"
    if "makeup" in normalized or "cosmetic" in normalized:
        return "makeup"
    if "hair" in normalized:
        return "haircare"
    return "beauty"


def is_perfume_row(*values: Any) -> bool:
    text = " ".join(clean_text(str(value)) for value in values if value)
    if PERFUME_EXCLUDE_RE.search(text):
        return False
    return bool(PERFUME_INCLUDE_RE.search(text))


def chemist_category(item: dict[str, Any]) -> str:
    l2 = str(item.get("l2_category") or "")
    if l2 == "542":
        return "fragrance"
    name = str(item.get("name") or "")
    return category_from_type(name)


def flatten_json_ld(payload: Any) -> list[dict[str, Any]]:
    if isinstance(payload, list):
        return [item for child in payload for item in flatten_json_ld(child)]
    if isinstance(payload, dict):
        graph = payload.get("@graph")
        if isinstance(graph, list):
            return [payload, *[item for child in graph for item in flatten_json_ld(child)]]
        return [payload]
    return []


def brand_from_jsonld(value: Any) -> str | None:
    if isinstance(value, dict):
        return value.get("name")
    if isinstance(value, str):
        return value
    return None


def image_from_jsonld(value: Any) -> str | None:
    if isinstance(value, list):
        return str(value[0]) if value else None
    if isinstance(value, str):
        return value
    if isinstance(value, dict):
        return value.get("url")
    return None
