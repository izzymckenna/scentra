from __future__ import annotations

from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.base import Base
from app.db.session import engine
from app.models import *  # noqa: F403


async def create_schema() -> None:
    async with engine.begin() as conn:
        await conn.execute(text("CREATE EXTENSION IF NOT EXISTS postgis"))
        await conn.run_sync(Base.metadata.create_all)


async def seed_nz_retailers(db: AsyncSession) -> None:
    from app.models import Retailer, Store

    retailers = [
        {
            "name": "Chemist Warehouse NZ",
            "slug": "chemist-warehouse-nz",
            "website_url": "https://www.chemistwarehouse.co.nz",
            "approved": True,
        },
        {
            "name": "Life Pharmacy",
            "slug": "life-pharmacy",
            "website_url": "https://www.lifepharmacy.co.nz",
            "approved": True,
        },
        {
            "name": "Farmers",
            "slug": "farmers",
            "website_url": "https://www.farmers.co.nz",
            "approved": True,
        },
        {
            "name": "Sephora NZ",
            "slug": "sephora-nz",
            "website_url": "https://www.sephora.nz",
            "approved": True,
        },
        {
            "name": "HealthPost",
            "slug": "healthpost",
            "website_url": "https://www.healthpost.co.nz",
            "approved": True,
        },
        {
            "name": "The Warehouse",
            "slug": "the-warehouse",
            "website_url": "https://www.thewarehouse.co.nz",
            "approved": True,
        },
        {
            "name": "The Brand Outlet",
            "slug": "brand-outlet",
            "website_url": "https://www.thebrandoutlet.co.nz",
            "approved": True,
        },
        {
            "name": "Perfume NZ",
            "slug": "perfume-nz",
            "website_url": "https://www.perfumenz.co.nz",
            "approved": True,
        },
        {
            "name": "Scent Boutique",
            "slug": "scent-boutique",
            "website_url": "https://scentboutique.co.nz",
            "approved": True,
        },
        {
            "name": "Miller Road",
            "slug": "miller-road",
            "website_url": "https://millerroad.co.nz",
            "approved": True,
        },
    ]
    retailer_ids: dict[str, int] = {}
    for payload in retailers:
        retailer = await db.scalar(select(Retailer).where(Retailer.slug == payload["slug"]))
        if retailer is None:
            retailer = Retailer(**payload)
            db.add(retailer)
            await db.flush()
        retailer_ids[payload["slug"]] = retailer.id
    await db.flush()

    stores = [
        {
            "retailer_slug": "chemist-warehouse-nz",
            "name": "Chemist Warehouse Queen Street",
            "address": "Queen Street, Auckland CBD",
            "suburb": "Auckland CBD",
            "city": "Auckland",
            "region": "Auckland",
            "postcode": "1010",
            "latitude": -36.848461,
            "longitude": 174.763336,
        },
        {
            "retailer_slug": "life-pharmacy",
            "name": "Life Pharmacy Lambton Quay",
            "address": "Lambton Quay, Wellington Central",
            "suburb": "Wellington Central",
            "city": "Wellington",
            "region": "Wellington",
            "postcode": "6011",
            "latitude": -41.285153,
            "longitude": 174.776230,
        },
        {
            "retailer_slug": "farmers",
            "name": "Farmers Riccarton",
            "address": "129 Riccarton Road",
            "suburb": "Riccarton",
            "city": "Christchurch",
            "region": "Canterbury",
            "postcode": "8041",
            "latitude": -43.530926,
            "longitude": 172.598080,
        },
    ]
    for payload in stores:
        retailer_slug = payload.pop("retailer_slug")
        existing = await db.scalar(
            select(Store).where(
                Store.retailer_id == retailer_ids[retailer_slug],
                Store.name == payload["name"],
                Store.postcode == payload["postcode"],
            )
        )
        if existing is not None:
            continue
        db.add(
            Store(
                **payload,
                retailer_id=retailer_ids[retailer_slug],
                location=f"SRID=4326;POINT({payload['longitude']} {payload['latitude']})",
            )
        )
    await db.commit()
