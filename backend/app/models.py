"""
Pydantic models for API request/response shapes.
"""

from __future__ import annotations
from typing import Optional
from pydantic import BaseModel, Field
from app.wer import WerStatus


# ---------------------------------------------------------------------------
# WER
# ---------------------------------------------------------------------------

class WerResponse(BaseModel):
    district: str
    gender: Optional[str] = None       # None = aggregated across all genders
    age_group: Optional[str] = None    # None = aggregated across all age groups
    status: WerStatus
    wer_pct: Optional[float] = None    # Only populated for OK / HIGH_WER
    recording_count: int
    reference_word_count: int
    substitutions: int
    deletions: int
    insertions: int
    threshold_min_recordings: int
    threshold_min_words: int


# ---------------------------------------------------------------------------
# Coverage matrix
# ---------------------------------------------------------------------------

class CoverageStatus(str):
    pass


class CoverageCell(BaseModel):
    district: str
    gender: str
    age_group: str
    status: str   # "no_data" | "insufficient" | "ok"
    recording_count: int


class CoverageMatrix(BaseModel):
    cells: list[CoverageCell]
    districts: list[str]
    genders: list[str]
    age_groups: list[str]


# ---------------------------------------------------------------------------
# Priorities
# ---------------------------------------------------------------------------

class CollectionPriority(BaseModel):
    rank: int
    district: str
    gender: str
    age_group: str
    reason: str
    gap_type: str        # "missing" | "insufficient" | "high_wer"
    recording_count: int
    recommended_target: int


class PrioritiesResponse(BaseModel):
    priorities: list[CollectionPriority]
    thresholds: dict[str, float]
    disclaimer: str


# ---------------------------------------------------------------------------
# Feedback
# ---------------------------------------------------------------------------

class FeedbackRequest(BaseModel):
    cell_id: str = Field(..., description="district|gender|age_group key")
    comment: str
    reviewer: str
    agreed_with_priority: Optional[bool] = None


class FeedbackResponse(BaseModel):
    accepted: bool
    message: str
