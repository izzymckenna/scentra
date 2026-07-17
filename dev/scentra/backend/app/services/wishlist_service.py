from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Wishlist, WishlistItem


class WishlistService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def add_item(self, user_id: int, product_id: int) -> WishlistItem:
        wishlist = await self._get_or_create_wishlist(user_id)
        existing = await self.db.scalar(
            select(WishlistItem).where(
                WishlistItem.wishlist_id == wishlist.id,
                WishlistItem.product_id == product_id,
            )
        )
        if existing:
            return existing
        item = WishlistItem(wishlist_id=wishlist.id, product_id=product_id)
        self.db.add(item)
        await self.db.commit()
        await self.db.refresh(item)
        return item

    async def remove_item(self, item_id: int) -> None:
        item = await self.db.get(WishlistItem, item_id)
        if item:
            await self.db.delete(item)
            await self.db.commit()

    async def _get_or_create_wishlist(self, user_id: int) -> Wishlist:
        wishlist = await self.db.scalar(select(Wishlist).where(Wishlist.user_id == user_id))
        if wishlist:
            return wishlist
        wishlist = Wishlist(user_id=user_id)
        self.db.add(wishlist)
        await self.db.commit()
        await self.db.refresh(wishlist)
        return wishlist
