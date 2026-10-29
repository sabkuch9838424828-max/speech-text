"""
Community intelligence aggregator.
Computes submission counts, approval stats, language coverage,
audio quality flags distribution, and verified WER metrics using
summed edit counts divided by summed reference words.
"""
from __future__ import annotations
import json
import sqlite3
from typing import Any
from app.db import get_connection
from app.wer import aggregate_wer, EditCounts

def get_community_summary_stats() -> dict[str, Any]:
    conn = get_connection()
    try:
        cur = conn.cursor()

        # Overall counts
        cur.execute("""
        SELECT
            COUNT(*) as total_submissions,
            SUM(CASE WHEN status = 'PENDING_REVIEW' THEN 1 ELSE 0 END) as pending_reviews,
            SUM(CASE WHEN status = 'APPROVED' THEN 1 ELSE 0 END) as approved_submissions,
            SUM(CASE WHEN status = 'REJECTED' THEN 1 ELSE 0 END) as rejected_submissions,
            SUM(CASE WHEN status = 'NEEDS_CORRECTION' THEN 1 ELSE 0 END) as needs_correction,
            SUM(CASE WHEN status = 'WITHDRAWN' THEN 1 ELSE 0 END) as withdrawn_submissions,
            SUM(CASE WHEN reference_text IS NOT NULL AND reference_text != '' THEN 1 ELSE 0 END) as with_reference_text,
            SUM(CASE WHEN reference_text IS NULL OR reference_text = '' THEN 1 ELSE 0 END) as natural_speech_no_ref
        FROM submissions;
        """)
        counts_row = cur.fetchone()

        total = counts_row["total_submissions"] or 0
        pending = counts_row["pending_reviews"] or 0
        approved = counts_row["approved_submissions"] or 0
        rejected = counts_row["rejected_submissions"] or 0
        needs_corr = counts_row["needs_correction"] or 0
        withdrawn = counts_row["withdrawn_submissions"] or 0
        with_ref = counts_row["with_reference_text"] or 0
        without_ref = counts_row["natural_speech_no_ref"] or 0

        # Language distribution
        cur.execute("""
        SELECT language, COUNT(*) as count,
               SUM(CASE WHEN status = 'APPROVED' THEN 1 ELSE 0 END) as approved_count
        FROM submissions
        WHERE status != 'WITHDRAWN'
        GROUP BY language
        ORDER BY count DESC;
        """)
        lang_rows = cur.fetchall()
        language_coverage = [
            {"language": r["language"], "count": r["count"], "approved_count": r["approved_count"]}
            for r in lang_rows
        ]

        # Audio quality flags distribution
        cur.execute("SELECT quality_flags_json FROM submissions WHERE status != 'WITHDRAWN';")
        flag_rows = cur.fetchall()
        quality_counts: dict[str, int] = {}
        for r in flag_rows:
            flags = json.loads(r["quality_flags_json"] or "[]")
            for f in flags:
                quality_counts[f] = quality_counts.get(f, 0) + 1

        # Verified Community WER aggregation (Strict sum of edits / sum of reference words)
        cur.execute("""
        SELECT substitutions, deletions, insertions, reference_word_count
        FROM submissions
        WHERE status = 'APPROVED' AND is_excluded = 0 AND reference_word_count > 0;
        """)
        verified_rows = cur.fetchall()
        edit_counts_list = [
            EditCounts(
                substitutions=r["substitutions"],
                deletions=r["deletions"],
                insertions=r["insertions"],
                reference_word_count=r["reference_word_count"]
            )
            for r in verified_rows
        ]

        wer_result = aggregate_wer(edit_counts_list, min_recordings=1, min_reference_words=1)

        # Active Benchmark info
        cur.execute("SELECT version, published_at FROM datasets WHERE is_active_benchmark = 1 LIMIT 1;")
        active_bm = cur.fetchone()
        benchmark_version = active_bm["version"] if active_bm else "None (v0.2 Baseline)"
        last_published = active_bm["published_at"] if active_bm else None

        return {
            "total_submissions": total,
            "pending_reviews": pending,
            "approved_submissions": approved,
            "rejected_submissions": rejected,
            "needs_correction": needs_corr,
            "withdrawn_submissions": withdrawn,
            "with_reference_transcript": with_ref,
            "without_reference_transcript": without_ref,
            "language_coverage": language_coverage,
            "quality_flags_distribution": quality_counts,
            "verified_wer_pct": wer_result.wer_pct,
            "verified_wer_status": wer_result.status.value,
            "verified_recordings_count": len(edit_counts_list),
            "substitutions": wer_result.substitutions,
            "deletions": wer_result.deletions,
            "insertions": wer_result.insertions,
            "reference_word_count": wer_result.reference_word_count,
            "active_benchmark_version": benchmark_version,
            "last_publication_timestamp": last_published,
        }
    finally:
        conn.close()
