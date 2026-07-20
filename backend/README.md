# Scentra Backend

FastAPI backend for Scentra, focused on New Zealand fragrance and beauty price comparison.

## Stack

- FastAPI service layer
- PostgreSQL with PostGIS for NZ store lookup
- SQLAlchemy async ORM
- Meilisearch product index for typo-tolerant catalogue search
- Redis for popular searches, product pages, and deal feeds
- RQ worker skeleton for daily retailer imports

## Local Run

```bash
cd /Users/izzymckenna/Desktop/dev/scentra
docker compose up -d postgres redis meilisearch

cd backend
/opt/homebrew/opt/python@3.14/bin/python3.14 -m venv .venv
source .venv/bin/activate
python -m pip install -e ".[dev]"
cp .env.example .env
python scripts_init_db.py
uvicorn app.main:app --reload
```

API docs: `http://localhost:8000/docs`

## Main Routes

- `GET /api/search?q=...`
- `GET /api/explore`
- `GET /api/products/{slug}`
- `GET /api/products/{id}/offers`
- `GET /api/deals`
- `GET /api/stores/nearby?latitude=-36.85&longitude=174.76&radius_km=10`
- `POST /api/wishlist/items`
- `DELETE /api/wishlist/items/{id}`
- `POST /api/cart/items`
- `DELETE /api/cart/items/{id}`
- `POST /api/admin/imports`
- `POST /api/admin/imports/live`
- `POST /api/admin/imports/live/preview`
- `POST /api/admin/products/merge`
- `POST /api/admin/deals/recalculate`

## NZ Store Design

Stores are restricted to `country_code = 'NZ'`, include suburb/city/region/postcode fields, and store a PostGIS `geography(Point, 4326)` for accurate distance queries in metres. Offers can be online-only (`store_id = null`) or store-specific for click-and-collect and local stock.

Seed retailers include Chemist Warehouse NZ, Life Pharmacy, Lush, Farmers, Sephora NZ, and The Warehouse as approved starter sources.

## Daily Import Pipeline

`DailyPricePipeline` runs this flow:

1. Fetch retailer catalogue data.
2. Normalize product names and extract size/concentration.
3. Match products by barcode, exact brand/name/size, then fuzzy match.
4. Create a product or add a pending `product_match_reviews` row.
5. Create/update `product_offers`.
6. Append `price_history` when price changes.
7. Recalculate active deals.
8. Clear hot search/deal caches.
9. Search-index refresh hooks live in `ProductSearchIndex`.

## Price Scrape Cron

Set `price_scrape_urls` in the backend environment to a JSON list of product URLs, then run the enqueue script from cron:

```bash
cd /Users/izzymckenna/Desktop/dev/scentra/backend
SCENTRA_PRICE_SCRAPE=1 python scripts_enqueue_price_scrape.py
```

The script only enqueues the existing RQ job. The worker then runs `run_price_scrape()` and fetches the URLs listed in `price_scrape_urls`.

## Nightly Scrapes

Nightly imports and scrapes are triggered by `POST /api/admin/cron/nightly`, which queues the daily import, price scrape, and perfume scrape jobs.

Set `NIGHTLY_CRON_TOKEN` in the backend environment and send it as `X-Cron-Token` from your scheduler. The endpoint returns `202 Accepted` with the queued job IDs.

## Live NZ Retailer Imports

Live importers are configured for:

- Life Pharmacy: Shopify `search/suggest.json` product endpoint.
- Chemist Warehouse NZ: public `searchapiv2/suggest` product suggestions.
- HealthPost: Shopify `search/suggest.json` product endpoint.
- The Warehouse: public fragrance category product tiles.
- Lush NZ: configured but not used by default; the current storefront blocks or does not expose the product suggest endpoint this importer expects.
- Farmers: public search page JSON-LD parser, with explicit failure reporting when Akamai/WAF blocks the request.

Run all three:

```bash
python scripts_live_import.py --limit 100
```

Run a dry fetch/match for selected sources:

```bash
python scripts_live_import.py --retailer life-pharmacy --retailer chemist-warehouse-nz --term perfume --dry-run
```

Or call:

```bash
curl -X POST http://127.0.0.1:8000/api/admin/imports/live \
  -H 'Content-Type: application/json' \
  -d '{"retailer_slugs":["life-pharmacy","chemist-warehouse-nz","lush","farmers"],"terms":["perfume","fragrance"],"limit_per_retailer":100}'
```

Use `/api/admin/imports/live/preview` with the same payload to fetch live rows without a database write.

## Perfume Scrape

Run a perfume-only scrape across Life Pharmacy, Chemist Warehouse NZ, HealthPost, and The Warehouse with duplicate products merged by brand/name/size:

```bash
cd /Users/izzymckenna/Desktop/dev/scentra/backend
python scripts_scrape_perfumes.py
```

Or enqueue it through the worker:

```bash
cd /Users/izzymckenna/Desktop/dev/scentra/backend
SCENTRA_ENQUEUE_PERFUME_SCRAPE=1 python app/jobs/worker.py
```

## Scale Notes

The schema indexes product slug, brand/category, offer product/retailer/price/discount, price history by offer and time, active deal score, and store location with GiST. For millions of price rows, partition `price_history` monthly by `recorded_at` before production launch.
