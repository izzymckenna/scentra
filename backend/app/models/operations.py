from __future__ import annotations

from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, Index, Integer, Numeric, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.models.enums import ImportStatus, MatchDecision


class SearchLog(Base):
    __tablename__ = "search_logs"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), index=True)
    query: Mapped[str | None] = mapped_column(String(500), index=True)
    filters_json: Mapped[dict | None] = mapped_column(JSONB)
    result_count: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (Index("ix_search_logs_created", "created_at"),)


class ImportRun(Base):
    __tablename__ = "import_runs"

    id: Mapped[int] = mapped_column(primary_key=True)
    retailer_id: Mapped[int | None] = mapped_column(ForeignKey("retailers.id"), index=True)
    source_name: Mapped[str] = mapped_column(String(180))
    status: Mapped[ImportStatus] = mapped_column(Enum(ImportStatus, name="import_status"), index=True)
    total_rows: Mapped[int] = mapped_column(Integer, default=0)
    processed_rows: Mapped[int] = mapped_column(Integer, default=0)
    failed_rows: Mapped[int] = mapped_column(Integer, default=0)
    error_message: Mapped[str | None] = mapped_column(Text)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class ProductMatchReview(Base):
    __tablename__ = "product_match_reviews"

    id: Mapped[int] = mapped_column(primary_key=True)
    import_run_id: Mapped[int | None] = mapped_column(ForeignKey("import_runs.id"), index=True)
    candidate_payload: Mapped[dict] = mapped_column(JSONB)
    matched_product_id: Mapped[int | None] = mapped_column(ForeignKey("products.id"), index=True)
    confidence: Mapped[float] = mapped_column(Numeric(5, 4))
    decision: Mapped[MatchDecision] = mapped_column(
        Enum(MatchDecision, name="match_decision"), default=MatchDecision.pending, index=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
