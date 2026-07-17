from __future__ import annotations

import argparse
import asyncio

from app.db.session import AsyncSessionLocal
from app.services.live_import_service import LiveImportService


async def main() -> None:
    parser = argparse.ArgumentParser(description="Import live NZ retailer data into Scentra.")
    parser.add_argument(
        "--retailer",
        action="append",
        dest="retailers",
        default=[],
        help="Retailer slug. Repeatable. Defaults to Life Pharmacy, Chemist Warehouse, Lush, and Farmers.",
    )
    parser.add_argument("--term", action="append", dest="terms", default=[], help="Search term. Repeatable.")
    parser.add_argument("--limit", type=int, default=100, help="Maximum products per retailer.")
    parser.add_argument("--dry-run", action="store_true", help="Fetch and match without writing offers.")
    args = parser.parse_args()

    retailers = args.retailers or ["life-pharmacy", "chemist-warehouse-nz", "lush", "farmers"]
    async with AsyncSessionLocal() as db:
        results = await LiveImportService(db).import_retailers(
            retailer_slugs=retailers,
            terms=args.terms or None,
            limit_per_retailer=args.limit,
            dry_run=args.dry_run,
        )
    for result in results:
        print(result)


if __name__ == "__main__":
    asyncio.run(main())
