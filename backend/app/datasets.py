"""
Versioned dataset publishing, snapshot freezing, and split management.
Guarantees that unapproved, withdrawn, or unconsented data never enters benchmarks.
Prevents data leakage with contributor-grouped splits.
"""
from __future__ import annotations
import hashlib
import json
import sqlite3
import uuid
from datetime import datetime, timezone
from typing import Any, Optional

from app.db import get_connection

class DatasetPublicationError(Exception):
    """Raised when publication requirements are not met."""
    pass

def publish_dataset_snapshot(
    version: str,
    title: str,
    description: str,
    published_by: str,
    split_ratios: Optional[dict[str, float]] = None,
    set_as_active_benchmark: bool = False,
) -> dict[str, Any]:
    """
    Atomically creates an immutable dataset snapshot from all currently APPROVED submissions.
    Splits into train (70%), validation (15%), test (15%) with contributor-group isolation.
    """
    if not version or not version.strip():
        raise DatasetPublicationError("Dataset version string is required.")
    if not published_by or not published_by.strip():
        raise DatasetPublicationError("Publisher name/identity is required.")

    if split_ratios is None:
        split_ratios = {"train": 0.70, "validation": 0.15, "test": 0.15}

    conn = get_connection()
    try:
        cur = conn.cursor()
        # Verify version uniqueness
        cur.execute("SELECT id FROM datasets WHERE version = ?;", (version.strip(),))
        if cur.fetchone():
            raise DatasetPublicationError(f"Dataset version '{version.strip()}' already exists. Published versions are immutable.")

        # Query only strictly APPROVED, consented, non-excluded, non-withdrawn records
        cur.execute("""
        SELECT * FROM submissions
        WHERE status = 'APPROVED'
          AND is_excluded = 0
          AND consent_given = 1
        ORDER BY created_at ASC;
        """)
        eligible_rows = cur.fetchall()

        if len(eligible_rows) == 0:
            raise DatasetPublicationError("No approved, consented submissions are available to publish.")

        ds_id = f"ds_{version.strip().replace('.', '_')}"
        now_iso = datetime.now(timezone.utc).isoformat()

        # Group by contributor or district/language/gender/time slice to prevent leakage
        contributor_groups: dict[str, list[sqlite3.Row]] = {}
        for r in eligible_rows:
            # Group key based on district + gender + age_group or deletion token prefix
            grp_key = f"{r['district']}_{r['gender']}_{r['age_group']}"
            contributor_groups.setdefault(grp_key, []).append(r)

        # Allocate groups to splits deterministically using hash
        dataset_items_to_insert = []
        lang_counts: dict[str, int] = {}

        for grp_key, records in contributor_groups.items():
            # Hash group key to deterministically assign to split
            hash_val = int(hashlib.md5(grp_key.encode("utf-8")).hexdigest(), 16) % 100
            if hash_val < int(split_ratios["train"] * 100):
                split = "train"
            elif hash_val < int((split_ratios["train"] + split_ratios["validation"]) * 100):
                split = "validation"
            else:
                split = "test"

            for rec in records:
                lang = rec["language"]
                lang_counts[lang] = lang_counts.get(lang, 0) + 1
                approved_text = rec["reference_text"] or rec["hypothesis_text"]
                dataset_items_to_insert.append((
                    ds_id, rec["id"], approved_text, split, grp_key
                ))

        with conn:
            if set_as_active_benchmark:
                conn.execute("UPDATE datasets SET is_active_benchmark = 0;")

            conn.execute("""
            INSERT INTO datasets (
                id, version, title, description, total_records,
                language_breakdown_json, published_by, published_at, is_active_benchmark
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);
            """, (
                ds_id, version.strip(), title.strip(), description.strip(),
                len(dataset_items_to_insert), json.dumps(lang_counts),
                published_by.strip(), now_iso, 1 if set_as_active_benchmark else 0
            ))

            conn.executemany("""
            INSERT INTO dataset_items (
                dataset_id, submission_id, approved_text, split, contributor_group_id
            ) VALUES (?, ?, ?, ?, ?);
            """, dataset_items_to_insert)

        return {
            "dataset_id": ds_id,
            "version": version.strip(),
            "total_records": len(dataset_items_to_insert),
            "language_breakdown": lang_counts,
            "splits": {
                "train": sum(1 for it in dataset_items_to_insert if it[3] == "train"),
                "validation": sum(1 for it in dataset_items_to_insert if it[3] == "validation"),
                "test": sum(1 for it in dataset_items_to_insert if it[3] == "test"),
            },
            "published_at": now_iso,
            "is_active_benchmark": set_as_active_benchmark
        }
    finally:
        conn.close()

def list_datasets() -> list[dict[str, Any]]:
    conn = get_connection()
    try:
        cur = conn.cursor()
        cur.execute("SELECT * FROM datasets ORDER BY published_at DESC;")
        rows = cur.fetchall()
        result = []
        for r in rows:
            d = dict(r)
            d["language_breakdown"] = json.loads(d["language_breakdown_json"])
            # Fetch split stats
            cur.execute("""
            SELECT split, COUNT(*) as count FROM dataset_items
            WHERE dataset_id = ? GROUP BY split;
            """, (d["id"],))
            split_rows = cur.fetchall()
            d["splits"] = {sr["split"]: sr["count"] for sr in split_rows}
            result.append(d)
        return result
    finally:
        conn.close()

def get_dataset_details(dataset_id: str) -> Optional[dict[str, Any]]:
    conn = get_connection()
    try:
        cur = conn.cursor()
        cur.execute("SELECT * FROM datasets WHERE id = ? OR version = ?;", (dataset_id, dataset_id))
        r = cur.fetchone()
        if not r:
            return None
        d = dict(r)
        d["language_breakdown"] = json.loads(d["language_breakdown_json"])

        cur.execute("""
        SELECT di.id, di.split, di.approved_text, s.language, s.dialect,
               s.district, s.gender, s.age_group, s.audio_duration_sec, s.wer_pct
        FROM dataset_items di
        JOIN submissions s ON di.submission_id = s.id
        WHERE di.dataset_id = ?
        LIMIT 200;
        """, (d["id"],))
        item_rows = cur.fetchall()
        d["items_preview"] = [dict(it) for it in item_rows]
        return d
    finally:
        conn.close()
