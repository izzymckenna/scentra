from __future__ import annotations

import re
import unicodedata
from decimal import Decimal

from slugify import slugify


SIZE_RE = re.compile(r"\b(\d+(?:\.\d+)?)\s?(ml|g|kg|oz|l)\b", re.IGNORECASE)
CONCENTRATION_RE = re.compile(
    r"\b(eau de parfum|edp|eau de toilette|edt|parfum|extrait|cologne|body mist)\b",
    re.IGNORECASE,
)


def normalize_text(value: str) -> str:
    ascii_text = unicodedata.normalize("NFKD", value).encode("ascii", "ignore").decode()
    ascii_text = ascii_text.lower()
    ascii_text = re.sub(r"[^a-z0-9\s]+", " ", ascii_text)
    return re.sub(r"\s+", " ", ascii_text).strip()


def normalize_product_name(name: str, brand: str | None = None) -> str:
    normalized = normalize_text(name)
    if brand:
        brand_normalized = normalize_text(brand)
        normalized = re.sub(rf"\b{re.escape(brand_normalized)}\b", "", normalized)
    normalized = SIZE_RE.sub("", normalized)
    normalized = CONCENTRATION_RE.sub("", normalized)
    return re.sub(r"\s+", " ", normalized).strip()


def extract_size(name: str) -> str | None:
    match = SIZE_RE.search(name)
    return match.group(0).replace(" ", "").lower() if match else None


def size_to_ml(size: str | None) -> Decimal | None:
    if not size:
        return None
    match = SIZE_RE.search(size.replace(" ", ""))
    if not match:
        return None
    value = Decimal(match.group(1))
    unit = match.group(2).lower()
    if unit == "ml":
        return value
    if unit == "l":
        return value * Decimal("1000")
    if unit == "oz":
        return (value * Decimal("29.5735")).quantize(Decimal("0.01"))
    return None


def extract_concentration(name: str) -> str | None:
    match = CONCENTRATION_RE.search(name)
    return match.group(1).upper() if match else None


def product_slug(brand_name: str, product_name: str, size: str | None = None) -> str:
    return slugify(" ".join(part for part in [brand_name, product_name, size] if part))
