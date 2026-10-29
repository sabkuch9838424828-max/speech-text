"""
FastAPI application — BhashaLens WER Dashboard
⚠ All data is ILLUSTRATIVE DEMO DATA.
"""
from __future__ import annotations
import csv
import io
from typing import Optional

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

from app.data_loader import get_districts
from app.aggregator import (
    get_wer_for_group, get_wer_with_naive, get_overview,
    DEFAULT_MIN_RECORDINGS, DEFAULT_MIN_REFERENCE_WORDS, DEFAULT_HIGH_WER_THRESHOLD,
)
from app.coverage import build_coverage_matrix, get_summary_stats
from app.priorities import get_priorities
from app.language import get_language_distribution, get_district_language_matrix
from app.models import (
    WerResponse, WerCellDetail,
    CoverageMatrix, CoverageCell,
    SummaryStats,
    CollectionPriority, PrioritiesResponse,
    OverrideRequest, OverrideResponse,
    FeedbackRequest, FeedbackResponse,
)

app = FastAPI(
    title="BhashaLens WER Dashboard API",
    description="⚠ ILLUSTRATIVE DEMO DATA — not real district performance.",
    version="0.2.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory stores (MVP)
_feedback_store: list[dict] = []
_overrides: dict[str, dict] = {}   # cell_id → override data


# ── helpers ──────────────────────────────────────────────────────────────────

def _threshold_params(
    min_recordings: int,
    min_reference_words: int,
    high_wer_threshold: float,
) -> tuple[int, int, float]:
    return min_recordings, min_reference_words, high_wer_threshold


# ── health ───────────────────────────────────────────────────────────────────

@app.get("/api/health")
def health():
    return {
        "status": "ok",
        "data_label": "DEMO",
        "warning": "All data is illustrative and synthetic.",
    }


# ── reference data ───────────────────────────────────────────────────────────

@app.get("/api/districts")
def districts():
    return {"districts": get_districts()}


@app.get("/api/genders")
def genders():
    return {"genders": ["female", "male", "other"]}


@app.get("/api/age-groups")
def age_groups():
    return {"age_groups": ["under-18", "18-30", "31-50", "51+"]}


# ── summary ribbon ───────────────────────────────────────────────────────────

@app.get("/api/stats/summary", response_model=SummaryStats)
def stats_summary(
    min_recordings: int      = Query(DEFAULT_MIN_RECORDINGS, ge=1),
    min_reference_words: int = Query(DEFAULT_MIN_REFERENCE_WORDS, ge=1),
    high_wer_threshold: float = Query(DEFAULT_HIGH_WER_THRESHOLD, ge=0, le=100),
):
    data = get_summary_stats(
        min_recordings=min_recordings,
        min_reference_words=min_reference_words,
        high_wer_threshold=high_wer_threshold,
    )
    return SummaryStats(**data)


# ── WER overview ─────────────────────────────────────────────────────────────

@app.get("/api/wer/overview", response_model=list[WerResponse])
def wer_overview(
    min_recordings: int      = Query(DEFAULT_MIN_RECORDINGS, ge=1),
    min_reference_words: int = Query(DEFAULT_MIN_REFERENCE_WORDS, ge=1),
    high_wer_threshold: float = Query(DEFAULT_HIGH_WER_THRESHOLD, ge=0, le=100),
):
    results = []
    for item in get_overview(
        min_recordings=min_recordings,
        min_reference_words=min_reference_words,
        high_wer_threshold=high_wer_threshold,
    ):
        r = item["result"]
        results.append(WerResponse(
            district=item["district"], gender=None, age_group=None,
            status=r.status, wer_pct=r.wer_pct,
            recording_count=r.recording_count,
            reference_word_count=r.reference_word_count,
            substitutions=r.substitutions, deletions=r.deletions, insertions=r.insertions,
            threshold_min_recordings=min_recordings,
            threshold_min_words=min_reference_words,
        ))
    return results


# ── WER detail (filtered) ────────────────────────────────────────────────────

@app.get("/api/wer/detail", response_model=WerResponse)
def wer_detail(
    district: str            = Query(...),
    gender: Optional[str]    = Query(None),
    age_group: Optional[str] = Query(None),
    min_recordings: int      = Query(DEFAULT_MIN_RECORDINGS, ge=1),
    min_reference_words: int = Query(DEFAULT_MIN_REFERENCE_WORDS, ge=1),
    high_wer_threshold: float = Query(DEFAULT_HIGH_WER_THRESHOLD, ge=0, le=100),
):
    if district not in get_districts():
        raise HTTPException(404, detail=f"District '{district}' not found.")
    r = get_wer_for_group(
        district=district, gender=gender, age_group=age_group,
        min_recordings=min_recordings, min_reference_words=min_reference_words,
        high_wer_threshold=high_wer_threshold,
    )
    return WerResponse(
        district=district, gender=gender, age_group=age_group,
        status=r.status, wer_pct=r.wer_pct,
        recording_count=r.recording_count, reference_word_count=r.reference_word_count,
        substitutions=r.substitutions, deletions=r.deletions, insertions=r.insertions,
        threshold_min_recordings=min_recordings, threshold_min_words=min_reference_words,
    )


@app.get("/api/wer/cell-detail", response_model=WerCellDetail)
def wer_cell_detail(
    district: str            = Query(...),
    gender: Optional[str]    = Query(None),
    age_group: Optional[str] = Query(None),
    min_recordings: int      = Query(DEFAULT_MIN_RECORDINGS, ge=1),
    min_reference_words: int = Query(DEFAULT_MIN_REFERENCE_WORDS, ge=1),
    high_wer_threshold: float = Query(DEFAULT_HIGH_WER_THRESHOLD, ge=0, le=100),
):
    """Returns WER result PLUS naive average for the Math-Integrity modal."""
    if district not in get_districts():
        raise HTTPException(404, detail=f"District '{district}' not found.")
    r, naive = get_wer_with_naive(
        district=district, gender=gender, age_group=age_group,
        min_recordings=min_recordings, min_reference_words=min_reference_words,
        high_wer_threshold=high_wer_threshold,
    )
    return WerCellDetail(
        district=district, gender=gender, age_group=age_group,
        status=r.status, wer_pct=r.wer_pct,
        recording_count=r.recording_count, reference_word_count=r.reference_word_count,
        substitutions=r.substitutions, deletions=r.deletions, insertions=r.insertions,
        threshold_min_recordings=min_recordings, threshold_min_words=min_reference_words,
        naive_average_wer_pct=naive,
    )


# ── coverage matrix ──────────────────────────────────────────────────────────

@app.get("/api/coverage/matrix", response_model=CoverageMatrix)
def coverage_matrix(
    min_recordings: int      = Query(DEFAULT_MIN_RECORDINGS, ge=1),
    min_reference_words: int = Query(DEFAULT_MIN_REFERENCE_WORDS, ge=1),
    high_wer_threshold: float = Query(DEFAULT_HIGH_WER_THRESHOLD, ge=0, le=100),
):
    data = build_coverage_matrix(
        min_recordings=min_recordings,
        min_reference_words=min_reference_words,
        high_wer_threshold=high_wer_threshold,
    )
    return CoverageMatrix(
        cells=[CoverageCell(**c) for c in data["cells"]],
        districts=data["districts"],
        genders=data["genders"],
        age_groups=data["age_groups"],
    )


# ── priorities ───────────────────────────────────────────────────────────────

@app.get("/api/priorities", response_model=PrioritiesResponse)
def priorities(
    min_recordings: int      = Query(DEFAULT_MIN_RECORDINGS, ge=1),
    min_reference_words: int = Query(DEFAULT_MIN_REFERENCE_WORDS, ge=1),
    high_wer_threshold: float = Query(DEFAULT_HIGH_WER_THRESHOLD, ge=0, le=100),
):
    data = get_priorities(
        min_recordings=min_recordings,
        min_reference_words=min_reference_words,
        high_wer_threshold=high_wer_threshold,
    )
    # Merge in any community overrides
    for p in data["priorities"]:
        cid = f"{p['district']}|{p['gender']}|{p['age_group']}"
        if cid in _overrides:
            ov = _overrides[cid]
            p["recommended_target"] = ov.get("custom_target", p["recommended_target"])
            p["community_override"] = ov
    return PrioritiesResponse(
        priorities=[CollectionPriority(**p) for p in data["priorities"]],
        thresholds=data["thresholds"],
        disclaimer=data["disclaimer"],
    )


# ── CSV manifest export ──────────────────────────────────────────────────────

@app.get("/api/export/manifest")
def export_manifest(
    min_recordings: int      = Query(DEFAULT_MIN_RECORDINGS, ge=1),
    min_reference_words: int = Query(DEFAULT_MIN_REFERENCE_WORDS, ge=1),
    high_wer_threshold: float = Query(DEFAULT_HIGH_WER_THRESHOLD, ge=0, le=100),
):
    """Download a CSV of all collection priorities with community overrides merged in."""
    data = get_priorities(
        min_recordings=min_recordings,
        min_reference_words=min_reference_words,
        high_wer_threshold=high_wer_threshold,
    )
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow([
        "rank", "district", "gender", "age_group", "gap_type",
        "current_recordings", "target_recordings", "shortfall",
        "community_override", "override_reviewer", "override_role",
        "qualitative_tag", "notes", "reason",
    ])
    for p in data["priorities"]:
        cid = f"{p['district']}|{p['gender']}|{p['age_group']}"
        ov  = _overrides.get(cid, {})
        target    = ov.get("custom_target", p["recommended_target"])
        shortfall = max(0, target - p["recording_count"])
        writer.writerow([
            p["rank"], p["district"], p["gender"], p["age_group"], p["gap_type"],
            p["recording_count"], target, shortfall,
            "Yes" if ov else "No",
            ov.get("reviewer_name", ""),
            ov.get("reviewer_role", ""),
            ov.get("qualitative_tag", ""),
            ov.get("notes", ""),
            p["reason"],
        ])
    buf.seek(0)
    return StreamingResponse(
        iter([buf.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=bhashalens_field_manifest.csv"},
    )


# ── community overrides ──────────────────────────────────────────────────────

@app.post("/api/overrides", response_model=OverrideResponse)
def submit_override(body: OverrideRequest):
    if not body.reviewer_name.strip():
        raise HTTPException(422, "reviewer_name must not be empty.")
    if not body.reviewer_role.strip():
        raise HTTPException(422, "reviewer_role must not be empty.")
    if not body.notes.strip():
        raise HTTPException(422, "notes must not be empty.")
    _overrides[body.cell_id] = {
        "reviewer_name":    body.reviewer_name.strip(),
        "reviewer_role":    body.reviewer_role.strip(),
        "custom_target":    body.custom_target,
        "qualitative_tag":  body.qualitative_tag,
        "notes":            body.notes.strip(),
    }
    return OverrideResponse(
        accepted=True,
        message=f"Override by {body.reviewer_name.strip()} recorded for '{body.cell_id}'.",
        cell_id=body.cell_id,
    )


@app.get("/api/overrides")
def list_overrides():
    return {"overrides": _overrides}


# ── legacy feedback ───────────────────────────────────────────────────────────

@app.post("/api/feedback", response_model=FeedbackResponse)
def submit_feedback(body: FeedbackRequest):
    if not body.comment.strip():
        raise HTTPException(422, "Comment must not be empty.")
    if not body.reviewer.strip():
        raise HTTPException(422, "Reviewer name must not be empty.")
    _feedback_store.append(body.model_dump())
    return FeedbackResponse(
        accepted=True,
        message=f"Thank you, {body.reviewer.strip()}. Your feedback has been recorded.",
    )


@app.get("/api/feedback")
def list_feedback():
    return {"feedback": _feedback_store, "count": len(_feedback_store)}



# ── language distribution ─────────────────────────────────────────────────────

@app.get("/api/language/distribution")
def language_distribution(
    district: Optional[str] = Query(None),
    gender: Optional[str] = Query(None),
    age_group: Optional[str] = Query(None),
):
    """
    Language distribution filtered by district / gender / age_group.
    Returns per-language recording counts, WER, and age/district breakdowns.
    ⚠ ILLUSTRATIVE DEMO DATA.
    """
    return get_language_distribution(
        district=district or None,
        gender=gender or None,
        age_group=age_group or None,
    )


@app.get("/api/language/matrix")
def language_matrix():
    """
    Full district × language × age_group matrix.
    Used to render the language heatmap.
    ⚠ ILLUSTRATIVE DEMO DATA.
    """
    return get_district_language_matrix()
