# Scentra

React, Vite, and Tailwind UI prototype for a premium fragrance and beauty discovery app.

The repo now includes a FastAPI backend in `backend/` for Scentra product search, NZ store lookup, price comparison, deals, wishlist/cart APIs, and the daily retailer price import pipeline.

## Run locally

```bash
npm install
npm run dev
```

The frontend reads `VITE_API_URL` for the API base path. By default it uses `/api`, and Vite proxies that path to `VITE_API_PROXY_TARGET` during local development.

## Backend

```bash
docker compose up -d postgres redis meilisearch
cd backend
/opt/homebrew/opt/python@3.14/bin/python3.14 -m venv .venv
source .venv/bin/activate
python -m pip install -e ".[dev]"
cp .env.example .env
python scripts_init_db.py
uvicorn app.main:app --reload
```

API docs are available at `http://localhost:8000/docs`.

Live NZ retailer imports are available through `POST /api/admin/imports/live` and `backend/scripts_live_import.py` for Life Pharmacy, Chemist Warehouse NZ, and Farmers.

View at https://scentra-eta.vercel.app/
## Build

```bash
npm run build
```
