"""Pydantic models for BhashaLens API."""
from __future__ import annotations
from typing import Optional
from pydantic import BaseModel, Field
from app.wer import WerStatus


# ── WER ─────────────────────────────────────────────────────────────────────

class WerResponse(BaseModel):
    district: str
    gender: Optional[str] = None
    age_group: Optional[str] = None
    status: WerStatus
    wer_pct: Optional[float] = None
    recording_count: int
    reference_word_count: int
    substitutions: int
    deletions: int
    insertions: int
    threshold_min_recordings: int
    threshold_min_words: int


class WerCellDetail(WerResponse):
    """Extended WER result that includes the naive average for comparison."""
    naive_average_wer_pct: Optional[float] = None


# ── Coverage matrix ──────────────────────────────────────────────────────────

class CoverageCell(BaseModel):
    district: str
    gender: str
    age_group: str
    status: str
    recording_count: int
    wer_pct: Optional[float] = None
    reference_word_count: int
    substitutions: int
    deletions: int
    insertions: int


class CoverageMatrix(BaseModel):
    cells: list[CoverageCell]
    districts: list[str]
    genders: list[str]
    age_groups: list[str]


# ── Summary ribbon ───────────────────────────────────────────────────────────

class SummaryStats(BaseModel):
    total_districts: int
    total_cohort_cells: int
    validated_cohorts: int
    validated_pct: float
    high_wer_alerts: int
    high_wer_pct: float
    blindspots: int
    blindspots_pct: float
    insufficient_evidence: int
    cannot_calculate: int
    field_deficit_recordings: int
    recommended_target_per_cell: int


# ── Priorities ───────────────────────────────────────────────────────────────

class CollectionPriority(BaseModel):
    rank: int
    district: str
    gender: str
    age_group: str
    reason: str
    gap_type: str
    recording_count: int
    recommended_target: int


class PrioritiesResponse(BaseModel):
    priorities: list[CollectionPriority]
    thresholds: dict[str, float]
    disclaimer: str


# ── Community override ───────────────────────────────────────────────────────

class OverrideRequest(BaseModel):
    cell_id: str = Field(..., description="district|gender|age_group key")
    reviewer_name: str
    reviewer_role: str
    custom_target: Optional[int] = None
    qualitative_tag: Optional[str] = None
    notes: str


class OverrideResponse(BaseModel):
    accepted: bool
    message: str
    cell_id: str


# ── Feedback (legacy, kept for compatibility) ────────────────────────────────

class FeedbackRequest(BaseModel):
    cell_id: str
    comment: str
    reviewer: str
    agreed_with_priority: Optional[bool] = None


class FeedbackResponse(BaseModel):
    accepted: bool
    message: str
