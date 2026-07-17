from __future__ import annotations

import asyncio

from app.db.init_db import create_schema, seed_nz_retailers
from app.db.session import AsyncSessionLocal


async def main() -> None:
    await create_schema()
    async with AsyncSessionLocal() as db:
        await seed_nz_retailers(db)


if __name__ == "__main__":
    asyncio.run(main())
