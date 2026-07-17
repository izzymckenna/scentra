from __future__ import annotations

from fastapi import APIRouter, Depends, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import db_session
from app.schemas.user_state import WishlistItemCreate, WishlistItemOut
from app.services.wishlist_service import WishlistService

router = APIRouter(prefix="/wishlist", tags=["wishlist"])


@router.post("/items", response_model=WishlistItemOut, status_code=status.HTTP_201_CREATED)
async def add_wishlist_item(payload: WishlistItemCreate, db: AsyncSession = Depends(db_session)):
    return await WishlistService(db).add_item(payload.user_id, payload.product_id)


@router.delete("/items/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_wishlist_item(item_id: int, db: AsyncSession = Depends(db_session)):
    await WishlistService(db).remove_item(item_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
