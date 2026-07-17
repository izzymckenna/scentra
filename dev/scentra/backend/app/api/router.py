from __future__ import annotations

from fastapi import APIRouter

from app.api.routes import admin, cart, deals, perfumes, products, search, stores, wishlist

api_router = APIRouter(prefix="/api")
api_router.include_router(search.router)
api_router.include_router(products.router)
api_router.include_router(deals.router)
api_router.include_router(perfumes.router)
api_router.include_router(stores.router)
api_router.include_router(wishlist.router)
api_router.include_router(cart.router)
api_router.include_router(admin.router)
