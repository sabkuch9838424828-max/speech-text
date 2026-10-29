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


# ── BhashaLens 2.0 Models ───────────────────────────────────────────────────

class SubmissionCreateRequest(BaseModel):
    contribution_mode: str = Field(..., description="'guided' or 'natural'")
    language: str
    dialect: Optional[str] = None
    speech_context: Optional[str] = None
    prompt_id: Optional[str] = None
    reference_text: Optional[str] = None
    district: Optional[str] = None
    state: Optional[str] = None
    gender: Optional[str] = None
    age_group: Optional[str] = None
    consent_given: bool = True
    age_verified: bool = True
    consent_policy_version: str = "v2.0-community"
    audio_base64: Optional[str] = None
    audio_filename: Optional[str] = "recording.wav"
    content_type: Optional[str] = "audio/wav"


class ReviewActionRequest(BaseModel):
    submission_id: str
    reviewer_name: str
    reviewer_role: str
    action: str = Field(..., description="'APPROVE', 'REJECT', 'CORRECT', 'REQUEST_REVIEW', 'EXCLUDE'")
    corrected_transcript: Optional[str] = None
    rejection_reason: Optional[str] = None
    notes: Optional[str] = None


class WithdrawRequest(BaseModel):
    submission_id: str
    deletion_token: str
    reason: Optional[str] = "User requested withdrawal"


class PublishDatasetRequest(BaseModel):
    version: str
    title: str
    description: str
    published_by: str
    set_as_active_benchmark: bool = False


class EvaluateModelRequest(BaseModel):
    dataset_id: str
    candidate_model_name: str
    candidate_model_version: str
    split_to_evaluate: str = "test"
    evaluated_by: str = "Evaluation Lead"
    baseline_wer: Optional[float] = 22.4


class PromoteModelRequest(BaseModel):
    evaluation_id: str
    promoted_by: str
    reviewer_role: str = "admin"


# ── Auth & User Management Models ───────────────────────────────────────────

class RegisterRequest(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    email: str = Field(..., min_length=5, max_length=150)
    password: str = Field(..., min_length=8, max_length=128)
    role: Optional[str] = "USER"


class LoginRequest(BaseModel):
    email: str
    password: str


class UserResponse(BaseModel):
    id: str
    email: str
    name: str
    role: str
    is_active: bool
    created_at: str
    last_login_at: Optional[str] = None


class AuthResponse(BaseModel):
    user: UserResponse
    token: str
    message: str = "Authentication successful"


class UpdateUserStatusRequest(BaseModel):
    is_active: bool


class UpdateUserRoleRequest(BaseModel):
    role: str


class UserStatsResponse(BaseModel):
    total_submissions: int
    pending_review: int
    approved: int
    needs_correction: int
    withdrawn: int


