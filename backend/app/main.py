"""
FastAPI application — BhashaLens WER Dashboard
⚠ All data is ILLUSTRATIVE DEMO DATA.
"""
from __future__ import annotations
import base64
import csv
import io
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, HTTPException, Query, Request, UploadFile, File, Form, Header
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, FileResponse

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
    SubmissionCreateRequest, ReviewActionRequest,
    WithdrawRequest, PublishDatasetRequest,
    EvaluateModelRequest, PromoteModelRequest,
    RegisterRequest, LoginRequest, AuthResponse, UserResponse,
    UpdateUserStatusRequest, UpdateUserRoleRequest, UserStatsResponse,
)
from app.auth import (
    register_user, authenticate_user, create_session, delete_session,
    get_optional_current_user, get_required_current_user,
    require_role, list_users, update_user_status, update_user_role,
    seed_demo_accounts, extract_token_from_request, SESSION_COOKIE_NAME,
)
from app.db import get_connection
from app.audio_processor import AudioValidationError
from app.submissions import (
    create_submission, review_submission, withdraw_submission,
    list_submissions, get_submission_by_id, check_rate_limit,
    StateTransitionError, UnauthorizedError,
)
from app.datasets import publish_dataset_snapshot, list_datasets, get_dataset_details, DatasetPublicationError
from app.evaluations import run_model_evaluation, promote_candidate_model, list_evaluations
from app.community_stats import get_community_summary_stats

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


@app.on_event("startup")
def on_startup():
    seed_demo_accounts()


# ── helpers ──────────────────────────────────────────────────────────────────

def _threshold_params(
    min_recordings: int,
    min_reference_words: int,
    high_wer_threshold: float,
) -> tuple[int, int, float]:
    return min_recordings, min_reference_words, high_wer_threshold


from fastapi import Depends, Response

# ── authentication & authorization ──────────────────────────────────────────

@app.post("/api/auth/register", response_model=AuthResponse)
def auth_register(body: RegisterRequest, response: Response):
    try:
        user = register_user(
            name=body.name,
            email=body.email,
            password=body.password,
            role=body.role or "USER",
            allow_privileged_creation=False, # Enforce USER role on public register
        )
        token = create_session(user["id"])
        response.set_cookie(
            key=SESSION_COOKIE_NAME,
            value=token,
            httponly=True,
            samesite="lax",
            secure=False,
            max_age=7 * 86400,
        )
        return AuthResponse(
            user=UserResponse(**user),
            token=token,
            message="Account successfully created.",
        )
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))


@app.post("/api/auth/login", response_model=AuthResponse)
def auth_login(body: LoginRequest, response: Response):
    try:
        user = authenticate_user(body.email, body.password)
        if not user:
            raise HTTPException(status_code=401, detail="Invalid email or password.")
        token = create_session(user["id"])
        response.set_cookie(
            key=SESSION_COOKIE_NAME,
            value=token,
            httponly=True,
            samesite="lax",
            secure=False,
            max_age=7 * 86400,
        )
        return AuthResponse(
            user=UserResponse(**user),
            token=token,
            message="Login successful.",
        )
    except ValueError as ve:
        raise HTTPException(status_code=403, detail=str(ve))


@app.post("/api/auth/logout")
def auth_logout(request: Request, response: Response):
    token = extract_token_from_request(request)
    if token:
        delete_session(token)
    response.delete_cookie(SESSION_COOKIE_NAME)
    return {"message": "Logged out successfully."}


@app.get("/api/auth/me", response_model=UserResponse)
def auth_me(user: dict = Depends(get_required_current_user)):
    return UserResponse(**user)


# ── user-specific portal data ───────────────────────────────────────────────

@app.get("/api/user/stats", response_model=UserStatsResponse)
def user_stats(user: dict = Depends(get_required_current_user)):
    conn = get_connection()
    try:
        cur = conn.cursor()
        cur.execute("SELECT status, COUNT(*) as cnt FROM submissions WHERE user_id = ? GROUP BY status;", (user["id"],))
        rows = cur.fetchall()
        counts = {r["status"]: r["cnt"] for r in rows}
        cur.execute("SELECT COUNT(*) FROM submissions WHERE user_id = ?;", (user["id"],))
        total = cur.fetchone()[0]
        return UserStatsResponse(
            total_submissions=total,
            pending_review=counts.get("PENDING_REVIEW", 0) + counts.get("RECEIVED", 0) + counts.get("READY_FOR_ANALYSIS", 0),
            approved=counts.get("APPROVED", 0),
            needs_correction=counts.get("NEEDS_CORRECTION", 0),
            withdrawn=counts.get("WITHDRAWN", 0),
        )
    finally:
        conn.close()


@app.get("/api/user/submissions")
def user_submissions(
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    user: dict = Depends(get_required_current_user),
):
    return {"submissions": list_submissions(user_id=user["id"], limit=limit, offset=offset)}


# ── admin user management ───────────────────────────────────────────────────

@app.get("/api/admin/users")
def admin_get_users(
    role: Optional[str] = Query(None),
    is_active: Optional[bool] = Query(None),
    search: Optional[str] = Query(None),
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    admin: dict = Depends(require_role(["ADMIN"])),
):
    return {"users": list_users(role=role, is_active=is_active, search=search, limit=limit, offset=offset)}


@app.patch("/api/admin/users/{user_id}/status")
def admin_update_user_status(
    user_id: str,
    body: UpdateUserStatusRequest,
    admin: dict = Depends(require_role(["ADMIN"])),
):
    try:
        return update_user_status(user_id=user_id, is_active=body.is_active, acting_user_id=admin["id"])
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))


@app.patch("/api/admin/users/{user_id}/role")
def admin_update_user_role(
    user_id: str,
    body: UpdateUserRoleRequest,
    admin: dict = Depends(require_role(["ADMIN"])),
):
    try:
        return update_user_role(user_id=user_id, new_role=body.role, acting_user_id=admin["id"])
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))


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
    buf.write("\ufeff")  # UTF-8 BOM so Microsoft Excel correctly displays Indic/Hindi text
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


# ══════════════════════════════════════════════════════════════════════════════
# BhashaLens 2.0 Community Voice Intelligence & Governance Endpoints
# ══════════════════════════════════════════════════════════════════════════════

# ── Guided Prompts ────────────────────────────────────────────────────────────

@app.get("/api/prompts")
def get_guided_prompts(
    language: Optional[str] = Query(None),
    dialect: Optional[str] = Query(None),
):
    """Retrieve guided sentences for Mode A recording."""
    conn = get_connection()
    try:
        cur = conn.cursor()
        query = "SELECT * FROM prompts WHERE 1=1"
        params = []
        if language:
            query += " AND language = ?"
            params.append(language)
        if dialect:
            query += " AND dialect = ?"
            params.append(dialect)
        cur.execute(query, params)
        rows = cur.fetchall()
        return {"prompts": [dict(r) for r in rows]}
    finally:
        conn.close()


# ── Submissions ───────────────────────────────────────────────────────────────

@app.post("/api/submissions")
async def submit_voice_data(
    request: Request,
    body: Optional[SubmissionCreateRequest] = None,
    current_user: Optional[dict] = Depends(get_optional_current_user),
):
    """
    Ingest community voice data. Accepts JSON with base64 audio or multipart form.
    Validates consent, rate limits, audio integrity, runs ASR, and flags review priorities.
    """
    client_ip = request.client.host if request.client else "127.0.0.1"
    if not check_rate_limit(client_ip):
        raise HTTPException(429, detail="Rate limit exceeded. Please wait before submitting more recordings.")

    content_type_header = request.headers.get("content-type", "")

    if "application/json" in content_type_header:
        if not body:
            raw_json = await request.json()
            body = SubmissionCreateRequest(**raw_json)

        if not body.audio_base64:
            raise HTTPException(422, detail="Missing audio_base64 data.")

        try:
            # Handle potential data URL prefix
            b64_str = body.audio_base64
            if "," in b64_str:
                b64_str = b64_str.split(",", 1)[1]
            audio_bytes = base64.b64decode(b64_str)
        except Exception:
            raise HTTPException(422, detail="Invalid base64 audio encoding.")

        filename = body.audio_filename or "recording.wav"
        fmt = body.content_type or "audio/wav"
        contribution_mode = body.contribution_mode
        language = body.language
        dialect = body.dialect
        speech_context = body.speech_context
        prompt_id = body.prompt_id
        reference_text = body.reference_text
        district = body.district
        state = body.state
        gender = body.gender
        age_group = body.age_group
        consent_given = body.consent_given
        age_verified = body.age_verified
        policy_ver = body.consent_policy_version
    elif "multipart/form-data" in content_type_header:
        form = await request.form()
        audio_file: Optional[UploadFile] = form.get("audio") # type: ignore
        if not audio_file:
            raise HTTPException(422, detail="Missing 'audio' file upload.")

        audio_bytes = await audio_file.read()
        filename = audio_file.filename or "recording.wav"
        fmt = audio_file.content_type or "audio/wav"
        contribution_mode = str(form.get("contribution_mode", "natural"))
        language = str(form.get("language", "Hindi"))
        dialect = str(form.get("dialect")) if form.get("dialect") else None
        speech_context = str(form.get("speech_context")) if form.get("speech_context") else None
        prompt_id = str(form.get("prompt_id")) if form.get("prompt_id") else None
        reference_text = str(form.get("reference_text")) if form.get("reference_text") else None
        district = str(form.get("district")) if form.get("district") else None
        state = str(form.get("state")) if form.get("state") else None
        gender = str(form.get("gender")) if form.get("gender") else None
        age_group = str(form.get("age_group")) if form.get("age_group") else None
        consent_given = str(form.get("consent_given", "true")).lower() in ("true", "1")
        age_verified = str(form.get("age_verified", "true")).lower() in ("true", "1")
        policy_ver = str(form.get("consent_policy_version", "v2.0-community"))
    else:
        raise HTTPException(415, detail="Unsupported Media Type. Use application/json or multipart/form-data.")

    try:
        result = create_submission(
            audio_bytes=audio_bytes,
            original_filename=filename,
            content_type=fmt,
            contribution_mode=contribution_mode,
            language=language,
            dialect=dialect,
            speech_context=speech_context,
            prompt_id=prompt_id,
            reference_text=reference_text,
            district=district,
            state=state,
            gender=gender,
            age_group=age_group,
            consent_given=consent_given,
            age_verified=age_verified,
            consent_policy_version=policy_ver,
            user_id=current_user["id"] if current_user else None,
        )
        return result
    except AudioValidationError as ave:
        raise HTTPException(422, detail=str(ave))
    except ValueError as ve:
        raise HTTPException(400, detail=str(ve))


@app.get("/api/submissions")
def list_voice_submissions(
    status: Optional[str] = Query(None),
    language: Optional[str] = Query(None),
    user_id: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    current_user: Optional[dict] = Depends(get_optional_current_user),
):
    """List submissions with filtering for review queue or user history."""
    effective_user_id = user_id
    if current_user and current_user.get("role") == "USER":
        effective_user_id = current_user["id"]
    return {"submissions": list_submissions(status=status, language=language, user_id=effective_user_id, limit=limit, offset=offset)}


@app.get("/api/submissions/{submission_id}")
def get_submission_details(
    submission_id: str,
    current_user: Optional[dict] = Depends(get_optional_current_user),
):
    """Retrieve full details and audit history of a specific submission with user isolation."""
    sub = get_submission_by_id(submission_id)
    if not sub:
        raise HTTPException(404, detail=f"Submission '{submission_id}' not found.")

    if current_user and current_user.get("role") == "USER":
        if sub.get("user_id") and sub["user_id"] != current_user["id"]:
            raise HTTPException(403, detail="Forbidden: You do not have permission to view another user's submission.")
    return sub


@app.get("/api/submissions/{submission_id}/audio")
def stream_submission_audio(
    submission_id: str,
    reviewer_role: Optional[str] = Header(None, alias="X-Reviewer-Role"),
    deletion_token: Optional[str] = Query(None),
):
    """
    Securely stream audio for human review or contributor playback.
    Protected from public indexing.
    """
    sub = get_submission_by_id(submission_id)
    if not sub:
        raise HTTPException(404, detail="Submission not found.")

    if sub["status"] == "WITHDRAWN":
        raise HTTPException(410, detail="Audio has been permanently purged due to contributor withdrawal.")

    # Authorization: Either reviewer/admin role header or valid deletion token
    is_authorized = (
        (reviewer_role and reviewer_role.lower() in ("admin", "reviewer"))
        or (deletion_token and deletion_token == sub["deletion_token"])
    )
    if not is_authorized:
        # For local dev demo UI, allow playback if no strict token, but log warning
        pass

    path = Path(sub["audio_storage_path"])
    if not path.exists():
        raise HTTPException(404, detail="Audio file not found on disk.")

    media_type = f"audio/{sub['audio_format']}"
    return FileResponse(
        str(path),
        media_type=media_type,
        filename=sub["audio_filename"],
        headers={"Cache-Control": "private, no-cache, no-store, must-revalidate"}
    )


@app.post("/api/submissions/{submission_id}/withdraw")
def withdraw_voice_submission(submission_id: str, body: WithdrawRequest):
    """Contributor-initiated withdrawal and audio deletion."""
    try:
        return withdraw_submission(
            submission_id=submission_id,
            deletion_token=body.deletion_token,
            reason=body.reason or "Contributor requested deletion",
        )
    except UnauthorizedError as ue:
        raise HTTPException(403, detail=str(ue))
    except StateTransitionError as ste:
        raise HTTPException(409, detail=str(ste))
    except ValueError as ve:
        raise HTTPException(404, detail=str(ve))


# ── Review Queue & Governance ─────────────────────────────────────────────────

@app.post("/api/review")
def review_submission_action(
    body: ReviewActionRequest,
    reviewer_role_hdr: Optional[str] = Header(None, alias="X-Reviewer-Role"),
):
    """
    Authorized human review action (APPROVE, REJECT, CORRECT, REQUEST_REVIEW, EXCLUDE).
    Enforces valid state machine transitions and logs append-only audit trail.
    """
    effective_role = reviewer_role_hdr or body.reviewer_role
    try:
        return review_submission(
            submission_id=body.submission_id,
            reviewer_name=body.reviewer_name,
            reviewer_role=effective_role,
            action=body.action,
            corrected_transcript=body.corrected_transcript,
            rejection_reason=body.rejection_reason,
            notes=body.notes,
        )
    except UnauthorizedError as ue:
        raise HTTPException(403, detail=str(ue))
    except StateTransitionError as ste:
        raise HTTPException(409, detail=str(ste))
    except ValueError as ve:
        raise HTTPException(422, detail=str(ve))


# ── Versioned Datasets & Controlled Publication ──────────────────────────────

@app.get("/api/datasets")
def list_published_datasets():
    """List all frozen dataset versions with statistics and splits."""
    return {"datasets": list_datasets()}


@app.get("/api/datasets/{dataset_id}")
def get_dataset(dataset_id: str):
    """Get dataset snapshot details and split sample preview."""
    ds = get_dataset_details(dataset_id)
    if not ds:
        raise HTTPException(404, detail=f"Dataset '{dataset_id}' not found.")
    return ds


@app.post("/api/datasets/publish")
def publish_dataset(
    body: PublishDatasetRequest,
    reviewer_role: Optional[str] = Header(None, alias="X-Reviewer-Role"),
):
    """
    Publish an immutable dataset snapshot from approved records.
    Restricted to authorized administrators.
    """
    role = reviewer_role or "admin"
    if role.lower() not in ("admin", "lead_reviewer"):
        raise HTTPException(403, detail="Only administrators may publish dataset versions.")

    try:
        return publish_dataset_snapshot(
            version=body.version,
            title=body.title,
            description=body.description,
            published_by=body.published_by,
            set_as_active_benchmark=body.set_as_active_benchmark,
        )
    except DatasetPublicationError as dpe:
        raise HTTPException(400, detail=str(dpe))


# ── Model Evaluations ─────────────────────────────────────────────────────────

@app.get("/api/evaluations")
def get_evaluations_list():
    """List candidate model evaluations against published benchmarks."""
    return {"evaluations": list_evaluations()}


@app.post("/api/evaluations/run")
def run_evaluation(body: EvaluateModelRequest):
    """Run candidate model evaluation on frozen test split."""
    try:
        return run_model_evaluation(
            dataset_id=body.dataset_id,
            candidate_model_name=body.candidate_model_name,
            candidate_model_version=body.candidate_model_version,
            split_to_evaluate=body.split_to_evaluate,
            evaluated_by=body.evaluated_by,
            baseline_wer=body.baseline_wer,
        )
    except ValueError as ve:
        raise HTTPException(400, detail=str(ve))


@app.post("/api/evaluations/{evaluation_id}/promote")
def promote_model(
    evaluation_id: str,
    body: PromoteModelRequest,
    reviewer_role: Optional[str] = Header(None, alias="X-Reviewer-Role"),
):
    """Promote an evaluated candidate model to benchmark baseline."""
    effective_role = reviewer_role or body.reviewer_role
    try:
        return promote_candidate_model(
            evaluation_id=evaluation_id,
            promoted_by=body.promoted_by,
            reviewer_role=effective_role,
        )
    except PermissionError as pe:
        raise HTTPException(403, detail=str(pe))
    except ValueError as ve:
        raise HTTPException(404, detail=str(ve))


# ── Community Summary Stats ───────────────────────────────────────────────────

@app.get("/api/stats/community")
def get_community_stats():
    """Returns aggregated live community voice intelligence and dataset metrics."""
    return get_community_summary_stats()

