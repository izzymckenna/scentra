from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import db_session
from app.schemas.catalog import NoteOut, PriceComparisonOut, ProductDetailOut
from app.services.offer_service import OfferService
from app.services.product_service import ProductService

router = APIRouter(prefix="/products", tags=["products"])


@router.get("/{slug}", response_model=ProductDetailOut)
async def product_detail(slug: str, db: AsyncSession = Depends(db_session)):
    product = await ProductService(db).get_by_slug(slug)
    if product is None:
        raise HTTPException(status_code=404, detail="Product not found")
    notes = [
        NoteOut(
            id=item.fragrance_note.id,
            name=item.fragrance_note.name,
            slug=item.fragrance_note.slug,
            note_family=item.fragrance_note.note_family,
            note_type=item.note_type.value,
        )
        for item in product.notes
    ]
    return ProductDetailOut.model_validate(
        {
            **product.__dict__,
            "brand": product.brand,
            "category": product.category,
            "notes": notes,
            "images": product.images,
            "offers": product.offers,
        }
    )


@router.get("/{product_id:int}/offers", response_model=PriceComparisonOut)
async def product_offers(product_id: int, db: AsyncSession = Depends(db_session)):
    if await ProductService(db).get_by_id(product_id) is None:
        raise HTTPException(status_code=404, detail="Product not found")
    return await OfferService(db).compare_for_product(product_id)
