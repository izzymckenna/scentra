from __future__ import annotations

from fastapi import APIRouter, Depends, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import db_session
from app.schemas.user_state import CartItemCreate, CartItemOut
from app.services.cart_service import CartService

router = APIRouter(prefix="/cart", tags=["cart"])


@router.post("/items", response_model=CartItemOut, status_code=status.HTTP_201_CREATED)
async def add_cart_item(payload: CartItemCreate, db: AsyncSession = Depends(db_session)):
    return await CartService(db).add_item(payload.user_id, payload.product_offer_id, payload.quantity)


@router.delete("/items/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_cart_item(item_id: int, db: AsyncSession = Depends(db_session)):
    await CartService(db).remove_item(item_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
