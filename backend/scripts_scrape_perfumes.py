from __future__ import annotations

import asyncio
import json

from app.importers.live_retailers import DEFAULT_PERFUME_RETAILERS
from app.services.perfume_scrape_service import PerfumeScrapeService


async def main() -> None:
    payload = await PerfumeScrapeService().scrape(
        retailer_slugs=DEFAULT_PERFUME_RETAILERS,
    )
    print(json.dumps(payload, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    asyncio.run(main())
