from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Cart, CartItem


class CartService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def add_item(self, user_id: int, product_offer_id: int, quantity: int = 1) -> CartItem:
        cart = await self._get_or_create_cart(user_id)
        existing = await self.db.scalar(
            select(CartItem).where(
                CartItem.cart_id == cart.id,
                CartItem.product_offer_id == product_offer_id,
            )
        )
        if existing:
            existing.quantity += quantity
            await self.db.commit()
            await self.db.refresh(existing)
            return existing
        item = CartItem(cart_id=cart.id, product_offer_id=product_offer_id, quantity=quantity)
        self.db.add(item)
        await self.db.commit()
        await self.db.refresh(item)
        return item

    async def remove_item(self, item_id: int) -> None:
        item = await self.db.get(CartItem, item_id)
        if item:
            await self.db.delete(item)
            await self.db.commit()

    async def _get_or_create_cart(self, user_id: int) -> Cart:
        cart = await self.db.scalar(select(Cart).where(Cart.user_id == user_id))
        if cart:
            return cart
        cart = Cart(user_id=user_id)
        self.db.add(cart)
        await self.db.commit()
        await self.db.refresh(cart)
        return cart
