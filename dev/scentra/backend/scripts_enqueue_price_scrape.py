from __future__ import annotations

import asyncio
import os
import sys

from app.jobs.worker import enqueue_price_scrape


async def main() -> int:
    if os.environ.get("SCENTRA_PRICE_SCRAPE") != "1":
        print("Set SCENTRA_PRICE_SCRAPE=1 to enqueue the price scrape job.", file=sys.stderr)
        return 1

    job_id = await enqueue_price_scrape()
    print(job_id)
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
