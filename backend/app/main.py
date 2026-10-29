"""
FastAPI application for BhashaLens WER Dashboard.

⚠ All data served by this API is ILLUSTRATIVE DEMO DATA.
   It does not represent real district ASR performance.
"""

from __future__ import annotations
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from typing import Optional

from app.data_loader import get_districts, get_genders, get_age_groups
from app.aggregator import (
    get_wer_for_group,
    get_overview,
    DEFAULT_MIN_RECORDINGS,
    DEFAULT_MIN_REFERENCE_WORDS,
    DEFAULT_HIGH_WER_THRESHOLD,
)
from app.coverage import build_coverage_matrix
from app.priorities import get_priorities
from app.wer import WerStatus
from app.models import (
    WerResponse,
    CoverageMatrix,
    CoverageCell,
    CollectionPriority,
    PrioritiesResponse,
    FeedbackRequest,
    FeedbackResponse,
)

app = FastAPI(
    title="BhashaLens WER Dashboard API",
    description=(
        "⚠ ILLUSTRATIVE DEMO DATA — not real district performance. "
        "Bhasha & Bol Bharat hackathon MVP."
    ),
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Simple in-memory feedback store for MVP (not persisted across restarts)
_feedback_store: list[dict] = []


# ---------------------------------------------------------------------------
# Health
# ---------------------------------------------------------------------------

@app.get("/api/health")
def health():
    return {
        "status": "ok",
        "data_label": "DEMO",
        "warning": "All data is illustrative and synthetic.",
    }


# ---------------------------------------------------------------------------
# Reference data
# ---------------------------------------------------------------------------

@app.get("/api/districts")
def districts():
    return {"districts": get_districts()}


@app.get("/api/genders")
def genders():
    return {"genders": get_genders()}


@app.get("/api/age-groups")
def age_groups():
    return {"age_groups": get_age_groups()}


# ---------------------------------------------------------------------------
# WER endpoints
# ---------------------------------------------------------------------------

def _build_wer_response(
    district: str,
    gender: Optional[str],
    age_group: Optional[str],
    min_recordings: int,
    min_reference_words: int,
    high_wer_threshold: float,
) -> WerResponse:
    result = get_wer_for_group(
        district=district,
        gender=gender,
        age_group=age_group,
        min_recordings=min_recordings,
        min_reference_words=min_reference_words,
        high_wer_threshold=high_wer_threshold,
    )
    return WerResponse(
        district=district,
        gender=gender,
        age_group=age_group,
        status=result.status,
        wer_pct=result.wer_pct,
        recording_count=result.recording_count,
        reference_word_count=result.reference_word_count,
        substitutions=result.substitutions,
        deletions=result.deletions,
        insertions=result.insertions,
        threshold_min_recordings=min_recordings,
        threshold_min_words=min_reference_words,
    )


@app.get("/api/wer/overview", response_model=list[WerResponse])
def wer_overview(
    min_recordings: int = Query(DEFAULT_MIN_RECORDINGS, ge=1),
    min_reference_words: int = Query(DEFAULT_MIN_REFERENCE_WORDS, ge=1),
    high_wer_threshold: float = Query(DEFAULT_HIGH_WER_THRESHOLD, ge=0.0, le=100.0),
):
    """Aggregated WER per district (all genders and age groups combined)."""
    results = []
    for item in get_overview(
        min_recordings=min_recordings,
        min_reference_words=min_reference_words,
        high_wer_threshold=high_wer_threshold,
    ):
        r = item["result"]
        results.append(
            WerResponse(
                district=item["district"],
                gender=None,
                age_group=None,
                status=r.status,
                wer_pct=r.wer_pct,
                recording_count=r.recording_count,
                reference_word_count=r.reference_word_count,
                substitutions=r.substitutions,
                deletions=r.deletions,
                insertions=r.insertions,
                threshold_min_recordings=min_recordings,
                threshold_min_words=min_reference_words,
            )
        )
    return results


@app.get("/api/wer/detail", response_model=WerResponse)
def wer_detail(
    district: str = Query(..., description="District name"),
    gender: Optional[str] = Query(None),
    age_group: Optional[str] = Query(None),
    min_recordings: int = Query(DEFAULT_MIN_RECORDINGS, ge=1),
    min_reference_words: int = Query(DEFAULT_MIN_REFERENCE_WORDS, ge=1),
    high_wer_threshold: float = Query(DEFAULT_HIGH_WER_THRESHOLD, ge=0.0, le=100.0),
):
    """WER for a specific district, optionally filtered by gender and/or age group."""
    if district not in get_districts():
        raise HTTPException(status_code=404, detail=f"District '{district}' not found.")
    return _build_wer_response(
        district=district,
        gender=gender,
        age_group=age_group,
        min_recordings=min_recordings,
        min_reference_words=min_reference_words,
        high_wer_threshold=high_wer_threshold,
    )


# ---------------------------------------------------------------------------
# Coverage matrix
# ---------------------------------------------------------------------------

@app.get("/api/coverage/matrix", response_model=CoverageMatrix)
def coverage_matrix(
    min_recordings: int = Query(DEFAULT_MIN_RECORDINGS, ge=1),
):
    """Evidence coverage matrix: every expected district × gender × age cell."""
    data = build_coverage_matrix(min_recordings=min_recordings)
    return CoverageMatrix(
        cells=[CoverageCell(**c) for c in data["cells"]],
        districts=data["districts"],
        genders=data["genders"],
        age_groups=data["age_groups"],
    )


# ---------------------------------------------------------------------------
# Priorities
# ---------------------------------------------------------------------------

@app.get("/api/priorities", response_model=PrioritiesResponse)
def priorities(
    min_recordings: int = Query(DEFAULT_MIN_RECORDINGS, ge=1),
    high_wer_threshold: float = Query(DEFAULT_HIGH_WER_THRESHOLD, ge=0.0, le=100.0),
):
    """Ranked list of recording collection priorities with reasons."""
    data = get_priorities(
        min_recordings=min_recordings,
        high_wer_threshold=high_wer_threshold,
    )
    return PrioritiesResponse(
        priorities=[CollectionPriority(**p) for p in data["priorities"]],
        thresholds=data["thresholds"],
        disclaimer=data["disclaimer"],
    )


# ---------------------------------------------------------------------------
# Community feedback
# ---------------------------------------------------------------------------

@app.post("/api/feedback", response_model=FeedbackResponse)
def submit_feedback(body: FeedbackRequest):
    """
    Submit community review feedback on a collection priority recommendation.
    Feedback is stored in-memory for this MVP session.
    These reviews are NOT automatic decisions — they require human follow-up.
    """
    if not body.comment.strip():
        raise HTTPException(status_code=422, detail="Comment must not be empty.")
    if not body.reviewer.strip():
        raise HTTPException(status_code=422, detail="Reviewer name must not be empty.")

    _feedback_store.append({
        "cell_id": body.cell_id,
        "comment": body.comment.strip(),
        "reviewer": body.reviewer.strip(),
        "agreed_with_priority": body.agreed_with_priority,
    })

    return FeedbackResponse(
        accepted=True,
        message=(
            f"Thank you, {body.reviewer.strip()}. Your feedback on '{body.cell_id}' "
            "has been recorded and will be reviewed by the team."
        ),
    )


@app.get("/api/feedback")
def list_feedback():
    """List all submitted feedback (in-memory, MVP only)."""
    return {"feedback": _feedback_store, "count": len(_feedback_store)}
