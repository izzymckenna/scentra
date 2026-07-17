from __future__ import annotations

import asyncio
import json
import sys

from app.services.price_scrape_service import PriceScrapeService


async def main() -> int:
    urls = sys.argv[1:]
    if not urls:
        print("Usage: python scripts_scrape_prices.py <url> [<url> ...]", file=sys.stderr)
        return 1

    results = await PriceScrapeService().scrape_urls(urls, limit=len(urls))
    print(json.dumps({"results": results}, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
