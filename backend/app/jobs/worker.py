from __future__ import annotations

import asyncio
import os

from redis import Redis
from rq import Queue, Worker

from app.core.config import get_settings


QUEUE_NAME = "scentra-imports"


def queue() -> Queue:
    settings = get_settings()
    return Queue(QUEUE_NAME, connection=Redis.from_url(settings.redis_url))


def run_worker() -> None:
    settings = get_settings()
    worker = Worker([QUEUE_NAME], connection=Redis.from_url(settings.redis_url))
    worker.work()


async def enqueue_daily_import() -> str:
    job = queue().enqueue("app.jobs.tasks.run_daily_import")
    return job.id


async def enqueue_price_scrape() -> str:
    job = queue().enqueue("app.jobs.tasks.run_price_scrape")
    return job.id


async def enqueue_perfume_scrape() -> str:
    job = queue().enqueue("app.jobs.tasks.run_perfume_scrape")
    return job.id


if __name__ == "__main__":
    if os.environ.get("SCENTRA_ENQUEUE_DAILY") == "1":
        print(asyncio.run(enqueue_daily_import()))
    elif os.environ.get("SCENTRA_ENQUEUE_PRICE_SCRAPE") == "1":
        print(asyncio.run(enqueue_price_scrape()))
    elif os.environ.get("SCENTRA_ENQUEUE_PERFUME_SCRAPE") == "1":
        print(asyncio.run(enqueue_perfume_scrape()))
    else:
        run_worker()
