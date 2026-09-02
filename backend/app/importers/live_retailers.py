from __future__ import annotations

import asyncio
import html
import json
import re
from abc import ABC, abstractmethod
from decimal import Decimal, InvalidOperation
from html.parser import HTMLParser
from typing import Any
from urllib.parse import quote, urljoin

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
PERFUME_BRAND_SEARCHES = [
    ("Ariana Grande", "Ariana Grande"),
    ("Britney Spears", "Britney Spears"),
    ("Burberry", "Burberry"),
    ("Chanel", "Chanel"),
    ("Chloé", "Chloé"),
    ("Calvin Klein", "Calvin Klein"),
    ("Carolina Herrera", "Carolina Herrera"),
    ("Clinique", "Clinique"),
    ("Davidoff", "Davidoff"),
    ("David Beckham", "David Beckham"),
    ("Dolce & Gabbana", "Dolce & Gabbana"),
    ("Elizabeth Arden", "Elizabeth Arden"),
    ("Giorgio Armani", "Giorgio Armani"),
    ("Gucci", "Gucci"),
    ("Guess", "Guess"),
    ("Hugo Boss", "Hugo Boss"),
    ("Issey Miyake", "Issey Miyake"),
    ("Jean Paul Gaultier", "Jean Paul Gaultier"),
    ("Jimmy Choo", "Jimmy Choo"),
    ("Jo Malone", "Jo Malone"),
    ("Joop", "Joop"),
    ("Juicy Couture", "Juicy Couture"),
    ("Katy Perry", "Katy Perry"),
    ("Kenzo", "Kenzo"),
    ("Lancôme", "Lancôme"),
    ("Lattafa", "Lattafa"),
    ("Maison Margiela", "Maison Margiela"),
    ("Marc Jacobs", "Marc Jacobs"),
    ("Montblanc", "Montblanc"),
    ("Mugler", "Mugler"),
    ("Moschino", "Moschino"),
    ("Narciso Rodriguez", "Narciso Rodriguez"),
    ("Paco Rabanne", "Paco Rabanne"),
    ("Paris Hilton", "Paris Hilton"),
    ("Ralph Lauren", "Ralph Lauren"),
    ("Rihanna", "Rihanna"),
    ("Sabrina Carpenter", "Sabrina Carpenter"),
    ("Tommy Hilfiger", "Tommy Hilfiger"),
    ("Vera Wang", "Vera Wang"),
    ("Versace", "Versace"),
    ("Yves Saint Laurent", "Yves Saint Laurent"),
]
DEFAULT_PERFUME_RETAILERS = [
    "life-pharmacy",
    "chemist-warehouse-nz",
    "bargain-chemist",
    "healthpost",
    "perfume-nz",
    "scent-boutique",
    "miller-road",
    "unichem",
    "flo-and-frankie",
    "gadgets-online",
    "wally",
    "world",
    "sisters-and-co",
]
USER_AGENT = "ScentraBot/0.1 (+https://scentra.local; price comparison import)"
PERFUME_INCLUDE_RE = re.compile(r"\b(perfume|fragrance|parfum|eau de parfum|eau de toilette|edp|edt|body mist|perfume mist|cologne|extrait)\b", re.IGNORECASE)
PERFUME_TITLE_SIGNAL_RE = re.compile(
    r"\b(eau de parfum|eau de toilette|eau de cologne|edp|edt|edc|parfum|perfume|"
    r"extrait|cologne|body mist|body spray|fragrance mist|perfume mist|perfume oil|solid perfume|aftershave)\b",
    re.IGNORECASE,
)
PERFUME_CATEGORY_RE = re.compile(r"\b(perfume|fragrance|parfum|cologne)\b", re.IGNORECASE)
NON_WEARABLE_PRODUCT_RE = re.compile(
    r"\b(accessor(?:y|ies)|case|travel spray|sample|tester|refill|gift set|gift pack|display stand|"
    r"fragrance[ -]?free|home perfume|home fragrance|hair perfume|room spray|linen spray|pillow spray|"
    r"laundry|detergent|fabric softener|fabric freshener|dryer balls?|washing[ -]?up|washing liquid|"
    r"dish[ -]?wash(?:er|ing)?|surface spray|cleaning spray|multi[ -]?purpose spray|floor cleaner|floor wipes?|air freshener|"
    r"toilet|rimblock|cleaner|cleanser|cleansing|hand wash|face wash|body wash|shower gel|bubble bath|"
    r"bath oil|bath bomb|bath fizzer|shower bomb|soap|shampoo|conditioner|moisturiser|moisturizer|lotion|"
    r"hand cream|hand creme|body cream|face cream|serum|sunscreen|spf\s*\d+|make[ -]?up|makeup|lipstick|"
    r"lip gloss|eyeliner|eyeshadow|eye shadow|mascara|foundation|concealer|primer|palette|bronzer|brow|"
    r"lashes?|highlighter|setting spray|pressed powder|loose powder|nail polish|nail colour|sheet mask|face mask|"
    r"makeup remover|wipes?|sanitiser|sanitizer|disinfect(?:ant)?|deodorant|antiperspirant|toothpaste|"
    r"essential oil|massage oil|body oil|diffuser|candle|incense|scent stems?|aroma stone|pot[ -]?pourri|"
    r"body scrub|face scrub|lip balm|hand balm|bikini|workshop|apparel|clothing|t[ -]?shirt|shirt|tee|"
    r"cleaning spray|cleaning powder|washing powder|fragrance booster)\b",
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
        catalog_products = await fetch_shopify_catalog_products(self, limit)
        search_terms = expanded_perfume_terms(terms or DEFAULT_TERMS)
        for term in [None] if catalog_products is not None else search_terms:
            if catalog_products is not None:
                products = catalog_products
            else:
                assert term is not None
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
        request_errors: list[str] = []
        successful_requests = 0
        requested_terms = terms or DEFAULT_TERMS
        search_terms = list(requested_terms)
        if any(term.lower() in PERFUME_TERMS for term in requested_terms):
            search_terms.extend(query for query, _brand in PERFUME_BRAND_SEARCHES)
        search_terms = list(dict.fromkeys(search_terms))
        for term in search_terms:
            encoded_term = quote(term, safe="")
            try:
                response = await self._get_with_retry(
                    f"{self.base_url}/searchapiv2/suggest?&identifier=nz&search={encoded_term}",
                    headers={
                        "Referer": f"{self.base_url}/search?searchtext={encoded_term}",
                        "User-Agent": "Mozilla/5.0 ScentraBot/0.1",
                    },
                )
                ensure_json_response(response, self.slug)
                successful_requests += 1
            except (httpx.HTTPError, LiveRetailerImportError) as exc:
                request_errors.append(summarize_request_error(exc))
                continue
            groups = response.json().get("suggestionGroups", [])
            products = next((group.get("suggestions", []) for group in groups if group.get("indexName") == "3products"), [])
            for item in products:
                sku = str(item.get("secondId") or item.get("id") or item.get("producturl"))
                if not sku or sku in seen:
                    continue
                seen.add(sku)
                if not is_perfume_row(item.get("name"), chemist_category(item)):
                    continue
                brand = item.get("brand")
                if brand and brand.lower().startswith("cw nz"):
                    brand = infer_chemist_brand(item.get("name"))
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
        if successful_requests == 0 and request_errors:
            raise LiveRetailerImportError(
                f"{self.slug} returned no usable product responses. Last error: {request_errors[-1]}"
            )
        return rows


class HealthPostImporter(RetailerImporter):
    slug = "healthpost"
    source_name = "healthpost-shopify-suggest"
    base_url = "https://www.healthpost.co.nz"

    async def fetch_rows(self, terms: list[str] | None = None, limit: int = 100) -> list[dict[str, Any]]:
        rows: list[dict[str, Any]] = []
        seen: set[str] = set()
        catalog_products = await fetch_shopify_catalog_products(self, limit)
        search_terms = expanded_perfume_terms(terms or PERFUME_TERMS)
        for term in [None] if catalog_products is not None else search_terms:
            if catalog_products is not None:
                products = catalog_products
            else:
                assert term is not None
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
        catalog_products = await fetch_shopify_catalog_products(self, limit)
        search_terms = expanded_perfume_terms(terms or PERFUME_TERMS)
        for term in [None] if catalog_products is not None else search_terms:
            if catalog_products is not None:
                products = catalog_products
            else:
                assert term is not None
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
    search_terms: list[str] | None = None
    include_product_type_in_filter = True

    async def fetch_rows(self, terms: list[str] | None = None, limit: int = 100) -> list[dict[str, Any]]:
        rows: list[dict[str, Any]] = []
        seen: set[str] = set()
        request_errors: list[str] = []
        successful_requests = 0
        base_terms = self.search_terms if self.search_terms and (terms is None or terms == PERFUME_TERMS) else terms or PERFUME_TERMS
        search_terms = expanded_perfume_terms(base_terms)
        catalog_products = await fetch_shopify_catalog_products(self, limit)
        for term in [None] if catalog_products is not None else search_terms:
            if catalog_products is not None:
                products = catalog_products
                successful_requests += 1
            else:
                assert term is not None
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
                    successful_requests += 1
                except (httpx.HTTPError, LiveRetailerImportError) as exc:
                    request_errors.append(summarize_request_error(exc))
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
                product_type_for_filter = item.get("type") if self.include_product_type_in_filter else None
                if not is_perfume_row(name, item.get("body"), product_type_for_filter, item.get("vendor"), item.get("tags")):
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
        if successful_requests == 0 and request_errors:
            raise LiveRetailerImportError(
                f"{self.slug} returned no usable product responses. Last error: {request_errors[-1]}"
            )
        return rows


class ScentBoutiqueImporter(ShopifyPerfumeSuggestImporter):
    slug = "scent-boutique"
    source_name = "scent-boutique-shopify-suggest"
    base_url = "https://scentboutique.co.nz"


class MillerRoadImporter(ShopifyPerfumeSuggestImporter):
    slug = "miller-road"
    source_name = "miller-road-shopify-suggest"
    base_url = "https://millerroad.co.nz"


class UnichemImporter(ShopifyPerfumeSuggestImporter):
    slug = "unichem"
    source_name = "unichem-shopify-suggest"
    base_url = "https://www.unichem.co.nz"


class BargainChemistImporter(ShopifyPerfumeSuggestImporter):
    slug = "bargain-chemist"
    source_name = "bargain-chemist-shopify-suggest"
    base_url = "https://www.bargainchemist.co.nz"


class FloAndFrankieImporter(ShopifyPerfumeSuggestImporter):
    slug = "flo-and-frankie"
    source_name = "flo-and-frankie-shopify-suggest"
    base_url = "https://www.floandfrankie.com"
    search_terms = ["roll on perfume", "eau de parfum", "perfume oil", "body mist"]
    include_product_type_in_filter = False


class GadgetsOnlineImporter(ShopifyPerfumeSuggestImporter):
    slug = "gadgets-online"
    source_name = "gadgets-online-shopify-suggest"
    base_url = "https://www.gadgetsonline.co.nz"


class WallyImporter(ShopifyPerfumeSuggestImporter):
    slug = "wally"
    source_name = "wally-shopify-suggest"
    base_url = "https://wally.co.nz"


class WorldImporter(ShopifyPerfumeSuggestImporter):
    slug = "world"
    source_name = "world-shopify-suggest"
    base_url = "https://worldbrand.co.nz"


class SistersAndCoImporter(ShopifyPerfumeSuggestImporter):
    slug = "sisters-and-co"
    source_name = "sisters-and-co-shopify-suggest"
    base_url = "https://www.sistersandco.com"


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
        UnichemImporter.slug: UnichemImporter,
        BargainChemistImporter.slug: BargainChemistImporter,
        FloAndFrankieImporter.slug: FloAndFrankieImporter,
        GadgetsOnlineImporter.slug: GadgetsOnlineImporter,
        WallyImporter.slug: WallyImporter,
        WorldImporter.slug: WorldImporter,
        SistersAndCoImporter.slug: SistersAndCoImporter,
        LushImporter.slug: LushImporter,
        FarmersImporter.slug: FarmersImporter,
    }
    try:
        return importers[slug]()
    except KeyError as exc:
        raise LiveRetailerImportError(f"No live importer configured for retailer slug '{slug}'.") from exc


def expanded_perfume_terms(terms: list[str]) -> list[str]:
    expanded = list(terms)
    if any(PERFUME_INCLUDE_RE.search(term) for term in terms):
        expanded.extend(query for query, _brand in PERFUME_BRAND_SEARCHES)
    return list(dict.fromkeys(expanded))


async def fetch_shopify_catalog_products(
    importer: RetailerImporter,
    limit: int,
    *,
    max_pages: int = 40,
) -> list[dict[str, Any]] | None:
    """Return fragrance products from Shopify's catalogue, or None if unavailable."""
    matches: list[dict[str, Any]] = []
    page_size = 250
    for page in range(1, max_pages + 1):
        try:
            response = await importer._get_with_retry(
                f"{importer.base_url}/products.json",
                params={"limit": page_size, "page": page},
            )
            ensure_json_response(response, importer.slug)
        except (httpx.HTTPError, LiveRetailerImportError):
            return None

        products = response.json().get("products", [])
        if not isinstance(products, list):
            return None
        for product in products:
            normalized = normalize_shopify_catalog_product(product)
            if not normalized or not is_perfume_row(
                normalized.get("title"),
                normalized.get("body"),
                normalized.get("type"),
                normalized.get("vendor"),
                normalized.get("tags"),
            ):
                continue
            matches.append(normalized)
            if len(matches) >= limit:
                return matches
        if len(products) < page_size:
            break
    return matches


def normalize_shopify_catalog_product(product: dict[str, Any]) -> dict[str, Any] | None:
    handle = product.get("handle")
    if not handle or not product.get("title"):
        return None
    variants = product.get("variants") if isinstance(product.get("variants"), list) else []
    priced_variants = [
        (price, variant)
        for variant in variants
        if (price := parse_money_or_none(variant.get("price"))) is not None and price > 0
    ]
    if not priced_variants:
        return None
    price, cheapest_variant = min(priced_variants, key=lambda entry: entry[0])
    compare_at_prices = [
        compare_at
        for variant in variants
        if (compare_at := parse_money_or_none(variant.get("compare_at_price"))) is not None and compare_at > 0
    ]
    image = product.get("image") if isinstance(product.get("image"), dict) else {}
    images = product.get("images") if isinstance(product.get("images"), list) else []
    image_url = image.get("src") or (images[0].get("src") if images and isinstance(images[0], dict) else None)
    return {
        "id": product.get("id") or handle,
        "handle": handle,
        "title": product.get("title"),
        "vendor": product.get("vendor"),
        "type": product.get("product_type"),
        "body": product.get("body_html"),
        "tags": product.get("tags"),
        "price": str(price),
        "price_min": str(price),
        "price_max": str(max(entry[0] for entry in priced_variants)),
        "compare_at_price_min": str(min(compare_at_prices)) if compare_at_prices else None,
        "compare_at_price_max": str(max(compare_at_prices)) if compare_at_prices else None,
        "url": f"/products/{handle}",
        "image": image_url,
        "featured_image": {"url": image_url},
        "available": any(bool(variant.get("available", True)) for variant in variants),
        "variant_id": cheapest_variant.get("id"),
    }


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


def summarize_request_error(exc: Exception) -> str:
    if isinstance(exc, httpx.HTTPStatusError):
        return f"HTTP {exc.response.status_code} from {exc.response.url.host}"
    return clean_text(str(exc)) or type(exc).__name__


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


def infer_chemist_brand(name: str | None) -> str | None:
    normalized_name = clean_text(name).casefold() if clean_text(name) else ""
    for query, brand in sorted(PERFUME_BRAND_SEARCHES, key=lambda item: len(item[0]), reverse=True):
        if query.casefold() in normalized_name:
            return brand
    return None


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


def is_perfume_row(
    name: Any,
    description: Any = None,
    product_type: Any = None,
    vendor: Any = None,
    tags: Any = None,
) -> bool:
    title = clean_text(str(name)) if name else ""
    classification = clean_text(str(product_type)) if product_type else ""
    identity = " ".join(clean_text(str(value)) for value in (title, classification, tags) if value)
    if NON_WEARABLE_PRODUCT_RE.search(identity):
        return False
    if PERFUME_TITLE_SIGNAL_RE.search(title):
        return True
    # A storefront's explicit product type/category is trusted, but marketing
    # descriptions and tags are never sufficient evidence on their own.
    return bool(PERFUME_CATEGORY_RE.search(classification))


def chemist_category(item: dict[str, Any]) -> str:
    l2 = str(item.get("l2_category") or "")
    if l2 in {"542", "5070"}:
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
