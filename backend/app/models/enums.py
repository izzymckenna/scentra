from __future__ import annotations

import enum


class Gender(str, enum.Enum):
    women = "women"
    men = "men"
    unisex = "unisex"
    kids = "kids"
    not_applicable = "not_applicable"


class NoteType(str, enum.Enum):
    top = "top"
    middle = "middle"
    base = "base"
    general = "general"


class ImportStatus(str, enum.Enum):
    queued = "queued"
    running = "running"
    completed = "completed"
    failed = "failed"


class MatchDecision(str, enum.Enum):
    pending = "pending"
    approved = "approved"
    rejected = "rejected"
    merged = "merged"
