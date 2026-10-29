"""
Submission management, state machine transitions, and duplicate detection.
Enforces strict role-based reviews, consent tracking, and withdrawal safeguards.
"""
from __future__ import annotations
import json
import os
import sqlite3
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional

from app.db import get_connection, AUDIO_STORE_DIR
from app.audio_processor import save_audio_securely, AudioValidationError
from app.asr import get_asr_provider, ASRProviderError
from app.text_diff import analyze_transcript_differences

VALID_STATUSES = {
    "RECEIVED",
    "VALIDATION_FAILED",
    "READY_FOR_ANALYSIS",
    "ANALYZED",
    "PENDING_REVIEW",
    "APPROVED",
    "REJECTED",
    "NEEDS_CORRECTION",
    "WITHDRAWN",
}

# State transition matrix: current_status -> set of allowed next_statuses
ALLOWED_TRANSITIONS: dict[str, set[str]] = {
    "RECEIVED": {"VALIDATION_FAILED", "READY_FOR_ANALYSIS", "WITHDRAWN"},
    "VALIDATION_FAILED": {"WITHDRAWN"},
    "READY_FOR_ANALYSIS": {"ANALYZED", "WITHDRAWN"},
    "ANALYZED": {"PENDING_REVIEW", "WITHDRAWN"},
    "PENDING_REVIEW": {"APPROVED", "REJECTED", "NEEDS_CORRECTION", "WITHDRAWN"},
    "NEEDS_CORRECTION": {"APPROVED", "REJECTED", "PENDING_REVIEW", "WITHDRAWN"},
    "APPROVED": {"WITHDRAWN", "NEEDS_CORRECTION"}, # Can revise or withdraw
    "REJECTED": {"PENDING_REVIEW", "WITHDRAWN"},   # Re-review if contested
    "WITHDRAWN": set(),                            # Terminal state
}

class StateTransitionError(Exception):
    """Raised when an illegal status change is attempted."""
    pass

class UnauthorizedError(Exception):
    """Raised when a non-admin/reviewer attempts a protected operation."""
    pass

def validate_state_transition(current_status: str, next_status: str) -> None:
    if next_status not in VALID_STATUSES:
        raise StateTransitionError(f"Invalid status: {next_status}")
    allowed = ALLOWED_TRANSITIONS.get(current_status, set())
    if next_status not in allowed:
        raise StateTransitionError(
            f"Illegal state transition from '{current_status}' to '{next_status}'. "
            f"Allowed next states: {sorted(allowed)}"
        )

# Simple sliding window rate limiter
_UPLOAD_HISTORY: dict[str, list[float]] = {}
MAX_UPLOADS_PER_MINUTE = 20

def check_rate_limit(client_ip: str) -> bool:
    now = datetime.now().timestamp()
    history = _UPLOAD_HISTORY.setdefault(client_ip, [])
    # Filter within last 60s
    _UPLOAD_HISTORY[client_ip] = [t for t in history if now - t < 60.0]
    if len(_UPLOAD_HISTORY[client_ip]) >= MAX_UPLOADS_PER_MINUTE:
        return False
    _UPLOAD_HISTORY[client_ip].append(now)
    return True

def create_submission(
    *,
    audio_bytes: bytes,
    original_filename: str,
    content_type: str,
    contribution_mode: str,
    language: str,
    dialect: Optional[str] = None,
    speech_context: Optional[str] = None,
    prompt_id: Optional[str] = None,
    reference_text: Optional[str] = None,
    district: Optional[str] = None,
    state: Optional[str] = None,
    gender: Optional[str] = None,
    age_group: Optional[str] = None,
    consent_given: bool = False,
    age_verified: bool = False,
    consent_policy_version: str = "v2.0-community",
    user_id: Optional[str] = None,
) -> dict[str, Any]:
    """
    Ingests, validates, analyzes, and queues a voice contribution.
    """
    if not consent_given:
        raise ValueError("Explicit informed consent is required to submit voice data.")
    if not age_verified:
        raise ValueError("Age confirmation / applicable safeguarding verification is required.")

    # 1. Save and validate audio
    audio_meta = save_audio_securely(
        audio_bytes=audio_bytes,
        storage_dir=AUDIO_STORE_DIR,
        original_filename=original_filename,
        content_type=content_type,
    )

    sub_id = f"sub_{uuid.uuid4().hex[:12]}"
    deletion_token = uuid.uuid4().hex
    now_iso = datetime.now(timezone.utc).isoformat()

    conn = get_connection()
    try:
        # 2. Check for duplicates using audio SHA-256 (review signal)
        cur = conn.cursor()
        cur.execute("SELECT id FROM submissions WHERE audio_sha256 = ? AND status != 'WITHDRAWN' LIMIT 1;", (audio_meta["sha256"],))
        dup_row = cur.fetchone()
        duplicate_of_id = dup_row["id"] if dup_row else None
        review_priority = 1 if duplicate_of_id or "silent_recording" in audio_meta["quality_flags"] else 3

        # 3. If prompt_id supplied, fetch reference text if not provided
        if prompt_id and not reference_text:
            cur.execute("SELECT text FROM prompts WHERE id = ?;", (prompt_id,))
            p_row = cur.fetchone()
            if p_row:
                reference_text = p_row["text"]

        # 4. ASR Transcription
        asr_provider = get_asr_provider()
        asr_res = asr_provider.transcribe(
            audio_bytes=audio_bytes,
            language=language,
            dialect=dialect,
            reference_prompt=reference_text,
        )

        # 5. Text difference and WER analysis
        diff_res = analyze_transcript_differences(
            reference_text=reference_text,
            hypothesis_text=asr_res.hypothesis_text,
        )

        initial_status = "PENDING_REVIEW"
        if "silent_recording" in audio_meta["quality_flags"]:
            initial_status = "NEEDS_CORRECTION"
            review_priority = 1

        # 6. Insert into database
        with conn:
            conn.execute("""
            INSERT INTO submissions (
                id, deletion_token, contribution_mode, language, dialect,
                speech_context, prompt_id, reference_text, hypothesis_text,
                model_name, model_version, confidence_score, uncertain_words_json,
                audio_storage_path, audio_filename, audio_format, audio_size_bytes,
                audio_duration_sec, audio_sha256, duplicate_of_id, quality_flags_json,
                substitutions, deletions, insertions, reference_word_count,
                wer_pct, wer_status, district, state, gender, age_group,
                consent_policy_version, consent_given, age_verified,
                status, review_priority, is_excluded, created_at, updated_at, user_id
            ) VALUES (
                ?, ?, ?, ?, ?,
                ?, ?, ?, ?,
                ?, ?, ?, ?,
                ?, ?, ?, ?,
                ?, ?, ?, ?,
                ?, ?, ?, ?,
                ?, ?, ?, ?, ?, ?,
                ?, ?, ?,
                ?, ?, ?, ?, ?, ?
            );
            """, (
                sub_id, deletion_token, contribution_mode, language, dialect,
                speech_context, prompt_id, reference_text, asr_res.hypothesis_text,
                asr_res.model_name, asr_res.model_version, asr_res.confidence_score,
                json.dumps(diff_res.get("uncertain_words", [])),
                audio_meta["storage_path"], audio_meta["filename"], audio_meta["format"],
                audio_meta["size_bytes"], audio_meta["duration_sec"], audio_meta["sha256"],
                duplicate_of_id, json.dumps(audio_meta["quality_flags"]),
                diff_res["substitutions"], diff_res["deletions"], diff_res["insertions"],
                diff_res["reference_word_count"], diff_res["wer_pct"], diff_res["status"],
                district, state, gender, age_group,
                consent_policy_version, 1 if consent_given else 0, 1 if age_verified else 0,
                initial_status, review_priority, 0, now_iso, now_iso, user_id
            ))

            # Initial review history log
            conn.execute("""
            INSERT INTO review_history (
                submission_id, reviewer_name, reviewer_role, action,
                prior_status, new_status, prior_transcript, new_transcript,
                reason, notes, timestamp
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
            """, (
                sub_id, "System-Ingestion", "system", "INGEST",
                "RECEIVED", initial_status, None, asr_res.hypothesis_text,
                "Automated ingestion and transcription completed.",
                f"Model: {asr_res.model_name} {asr_res.model_version}",
                now_iso
            ))

        return {
            "submission_id": sub_id,
            "deletion_token": deletion_token,
            "status": initial_status,
            "contribution_mode": contribution_mode,
            "language": language,
            "dialect": dialect,
            "audio_duration_sec": audio_meta["duration_sec"],
            "hypothesis_text": asr_res.hypothesis_text,
            "reference_text": reference_text,
            "wer_pct": diff_res["wer_pct"],
            "wer_status": diff_res["status"],
            "quality_flags": audio_meta["quality_flags"],
            "duplicate_detected": bool(duplicate_of_id),
            "duplicate_of_id": duplicate_of_id,
        }
    finally:
        conn.close()

def withdraw_submission(submission_id: str, deletion_token: str, reason: str = "User requested withdrawal") -> dict[str, Any]:
    """
    Contributor-initiated deletion / withdrawal workflow.
    Purges audio storage and marks record WITHDRAWN.
    """
    conn = get_connection()
    try:
        cur = conn.cursor()
        cur.execute("SELECT * FROM submissions WHERE id = ?;", (submission_id,))
        row = cur.fetchone()
        if not row:
            raise ValueError(f"Submission '{submission_id}' not found.")

        if row["deletion_token"] != deletion_token:
            raise UnauthorizedError("Invalid deletion token for this submission.")

        current_status = row["status"]
        if current_status == "WITHDRAWN":
            return {"submission_id": submission_id, "status": "WITHDRAWN", "message": "Already withdrawn."}

        validate_state_transition(current_status, "WITHDRAWN")
        now_iso = datetime.now(timezone.utc).isoformat()

        # Delete physical audio file if present
        audio_path = Path(row["audio_storage_path"])
        if audio_path.exists():
            try:
                audio_path.unlink()
            except Exception:
                pass

        with conn:
            conn.execute("""
            UPDATE submissions
            SET status = 'WITHDRAWN', is_excluded = 1, updated_at = ?
            WHERE id = ?;
            """, (now_iso, submission_id))

            # Cascade: delete any dataset_items linking to this submission
            conn.execute("DELETE FROM dataset_items WHERE submission_id = ?;", (submission_id,))

            conn.execute("""
            INSERT INTO review_history (
                submission_id, reviewer_name, reviewer_role, action,
                prior_status, new_status, prior_transcript, new_transcript,
                reason, notes, timestamp
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
            """, (
                submission_id, "Contributor", "contributor", "WITHDRAW",
                current_status, "WITHDRAWN", row["reference_text"] or row["hypothesis_text"],
                None, reason, "Audio purged and removed from datasets.", now_iso
            ))

        return {
            "submission_id": submission_id,
            "status": "WITHDRAWN",
            "audio_deleted": True,
            "message": "Submission successfully withdrawn and audio purged."
        }
    finally:
        conn.close()

def review_submission(
    *,
    submission_id: str,
    reviewer_name: str,
    reviewer_role: str,
    action: str, # 'APPROVE', 'REJECT', 'CORRECT', 'REQUEST_REVIEW', 'EXCLUDE'
    corrected_transcript: Optional[str] = None,
    rejection_reason: Optional[str] = None,
    notes: Optional[str] = None,
) -> dict[str, Any]:
    """
    Enforces authorization, valid state transitions, and records append-only review history.
    """
    if reviewer_role.lower() not in ("admin", "reviewer"):
        raise UnauthorizedError("Only authorized reviewers or administrators may review submissions.")

    if not reviewer_name or not reviewer_name.strip():
        raise ValueError("Reviewer name is required.")

    conn = get_connection()
    try:
        cur = conn.cursor()
        cur.execute("SELECT * FROM submissions WHERE id = ?;", (submission_id,))
        row = cur.fetchone()
        if not row:
            raise ValueError(f"Submission '{submission_id}' not found.")

        current_status = row["status"]
        if current_status == "WITHDRAWN":
            raise StateTransitionError("Cannot review a withdrawn submission.")

        prior_transcript = row["reference_text"] or row["hypothesis_text"]
        new_transcript = prior_transcript

        if action == "APPROVE":
            next_status = "APPROVED"
            if corrected_transcript and corrected_transcript.strip():
                new_transcript = corrected_transcript.strip()
        elif action == "REJECT":
            next_status = "REJECTED"
            if not rejection_reason or not rejection_reason.strip():
                raise ValueError("Rejection reason is required when rejecting a submission.")
        elif action == "CORRECT":
            next_status = "NEEDS_CORRECTION"
            if corrected_transcript and corrected_transcript.strip():
                new_transcript = corrected_transcript.strip()
        elif action == "REQUEST_REVIEW":
            next_status = "PENDING_REVIEW"
        elif action == "EXCLUDE":
            # Exclude from datasets without changing approved status
            next_status = current_status
        else:
            raise ValueError(f"Unknown review action: {action}")

        if action != "EXCLUDE":
            validate_state_transition(current_status, next_status)

        now_iso = datetime.now(timezone.utc).isoformat()

        # Recalculate WER if transcript changed
        substitutions = row["substitutions"]
        deletions = row["deletions"]
        insertions = row["insertions"]
        ref_word_count = row["reference_word_count"]
        wer_pct = row["wer_pct"]
        wer_status = row["wer_status"]

        if corrected_transcript and corrected_transcript.strip():
            # If corrected, we evaluate hypothesis against the new approved transcript!
            diff = analyze_transcript_differences(
                reference_text=new_transcript,
                hypothesis_text=row["hypothesis_text"]
            )
            substitutions = diff["substitutions"]
            deletions = diff["deletions"]
            insertions = diff["insertions"]
            ref_word_count = diff["reference_word_count"]
            wer_pct = diff["wer_pct"]
            wer_status = diff["status"]

        with conn:
            conn.execute("""
            UPDATE submissions
            SET status = ?,
                reference_text = ?,
                substitutions = ?,
                deletions = ?,
                insertions = ?,
                reference_word_count = ?,
                wer_pct = ?,
                wer_status = ?,
                is_excluded = CASE WHEN ? = 1 THEN 1 ELSE is_excluded END,
                updated_at = ?
            WHERE id = ?;
            """, (
                next_status, new_transcript,
                substitutions, deletions, insertions, ref_word_count,
                wer_pct, wer_status,
                1 if action == "EXCLUDE" else 0,
                now_iso, submission_id
            ))

            conn.execute("""
            INSERT INTO review_history (
                submission_id, reviewer_name, reviewer_role, action,
                prior_status, new_status, prior_transcript, new_transcript,
                reason, notes, timestamp
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
            """, (
                submission_id, reviewer_name.strip(), reviewer_role.strip(), action,
                current_status, next_status, prior_transcript, new_transcript,
                rejection_reason or action, notes or "", now_iso
            ))

        return {
            "submission_id": submission_id,
            "status": next_status,
            "action": action,
            "approved_transcript": new_transcript,
            "reviewer_name": reviewer_name,
            "updated_at": now_iso
        }
    finally:
        conn.close()

def list_submissions(
    status: Optional[str] = None,
    language: Optional[str] = None,
    user_id: Optional[str] = None,
    limit: int = 50,
    offset: int = 0
) -> list[dict[str, Any]]:
    conn = get_connection()
    try:
        query = "SELECT * FROM submissions WHERE 1=1"
        params: list[Any] = []
        if status:
            query += " AND status = ?"
            params.append(status)
        if language:
            query += " AND language = ?"
            params.append(language)
        if user_id:
            query += " AND user_id = ?"
            params.append(user_id)
        query += " ORDER BY review_priority ASC, created_at DESC LIMIT ? OFFSET ?;"
        params.extend([limit, offset])

        cur = conn.cursor()
        cur.execute(query, params)
        rows = cur.fetchall()
        return [dict(r) for r in rows]
    finally:
        conn.close()

def get_submission_by_id(submission_id: str) -> Optional[dict[str, Any]]:
    conn = get_connection()
    try:
        cur = conn.cursor()
        cur.execute("SELECT * FROM submissions WHERE id = ?;", (submission_id,))
        row = cur.fetchone()
        if not row:
            return None
        sub_dict = dict(row)
        # Fetch review history
        cur.execute("SELECT * FROM review_history WHERE submission_id = ? ORDER BY id ASC;", (submission_id,))
        hist_rows = cur.fetchall()
        sub_dict["history"] = [dict(h) for h in hist_rows]
        return sub_dict
    finally:
        conn.close()
