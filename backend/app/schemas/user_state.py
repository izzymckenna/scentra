from __future__ import annotations

from pydantic import BaseModel


class WishlistItemCreate(BaseModel):
    user_id: int
    product_id: int


class WishlistItemOut(BaseModel):
    id: int
    wishlist_id: int
    product_id: int

    model_config = {"from_attributes": True}


class CartItemCreate(BaseModel):
    user_id: int
    product_offer_id: int
    quantity: int = 1


class CartItemOut(BaseModel):
    id: int
    cart_id: int
    product_offer_id: int
    quantity: int

    model_config = {"from_attributes": True}
