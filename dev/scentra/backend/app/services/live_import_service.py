from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.importers import LiveRetailerImportError, live_importer_for_slug
from app.models import ImportRun, Retailer
from app.models.enums import ImportStatus
from app.services.import_service import ImportService


class LiveImportService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def import_retailers(
        self,
        retailer_slugs: list[str],
        terms: list[str] | None = None,
        limit_per_retailer: int = 100,
        dry_run: bool = False,
    ) -> list[dict[str, Any]]:
        results = []
        for slug in retailer_slugs:
            retailer = await self.db.scalar(select(Retailer).where(Retailer.slug == slug))
            if retailer is None:
                results.append({"retailer_slug": slug, "status": "failed", "error": "Retailer not found"})
                continue
            importer = live_importer_for_slug(slug)
            try:
                rows = await importer.fetch_rows(terms=terms, limit=limit_per_retailer)
                run = await ImportService(self.db).import_rows(
                    retailer_id=retailer.id,
                    source_name=importer.source_name,
                    rows=rows,
                    dry_run=dry_run,
                )
                results.append(
                    {
                        "retailer_slug": slug,
                        "import_run_id": run.id,
                        "status": run.status.value,
                        "rows": len(rows),
                    }
                )
            except (LiveRetailerImportError, Exception) as exc:
                failed_run = await self._record_failed_run(retailer.id, importer.source_name, str(exc))
                results.append(
                    {
                        "retailer_slug": slug,
                        "import_run_id": failed_run.id,
                        "status": failed_run.status.value,
                        "rows": 0,
                        "error": str(exc),
                    }
                )
        return results

    async def _record_failed_run(self, retailer_id: int, source_name: str, error: str) -> ImportRun:
        run = ImportRun(
            retailer_id=retailer_id,
            source_name=source_name,
            status=ImportStatus.failed,
            error_message=error,
            started_at=datetime.now(UTC),
            finished_at=datetime.now(UTC),
        )
        self.db.add(run)
        await self.db.commit()
        await self.db.refresh(run)
        return run
