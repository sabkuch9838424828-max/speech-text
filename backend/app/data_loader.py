"""
Loads and validates demo recording data from JSON.
Enforces data integrity rules at load time.
"""

from __future__ import annotations
import json
import os
from pathlib import Path
from typing import Any

_DATA_PATH = Path(__file__).parent.parent / "data" / "demo_recordings.json"

_VALID_GENDERS = {"male", "female", "other"}
_VALID_AGE_GROUPS = {"under-18", "18-30", "31-50", "51+"}

_REQUIRED_FIELDS = {
    "id", "district", "state", "gender", "age_group",
    "substitutions", "deletions", "insertions", "reference_word_count",
}


def _validate_record(rec: dict[str, Any], idx: int) -> list[str]:
    errors = []
    for f in _REQUIRED_FIELDS:
        if f not in rec:
            errors.append(f"[rec #{idx}] Missing field: {f}")

    gender = rec.get("gender", "")
    if gender not in _VALID_GENDERS:
        errors.append(f"[rec #{idx}] Invalid gender: {gender!r}")

    age_group = rec.get("age_group", "")
    if age_group not in _VALID_AGE_GROUPS:
        errors.append(f"[rec #{idx}] Invalid age_group: {age_group!r}")

    for field in ("substitutions", "deletions", "insertions", "reference_word_count"):
        val = rec.get(field, -1)
        if not isinstance(val, int) or val < 0:
            errors.append(f"[rec #{idx}] {field} must be non-negative integer, got {val!r}")

    return errors


def load_recordings(path: Path = _DATA_PATH) -> list[dict[str, Any]]:
    """
    Load and validate demo recordings. Raises ValueError on schema errors.
    Records with reference_word_count == 0 are kept in the list but
    excluded from WER calculations by the aggregator.
    """
    with open(path, "r", encoding="utf-8") as f:
        raw = json.load(f)

    meta = raw.get("_meta", {})
    warning = meta.get("warning", "")
    if "ILLUSTRATIVE DEMO DATA" not in warning:
        raise ValueError(
            "Data file is missing required ILLUSTRATIVE DEMO DATA warning in _meta."
        )

    records = raw.get("recordings", [])
    all_errors: list[str] = []
    for i, rec in enumerate(records):
        all_errors.extend(_validate_record(rec, i))

    if all_errors:
        raise ValueError("Data validation errors:\n" + "\n".join(all_errors))

    return records


# Module-level cache
_cache: list[dict[str, Any]] | None = None


def get_recordings() -> list[dict[str, Any]]:
    global _cache
    if _cache is None:
        _cache = load_recordings()
    return _cache


def get_districts() -> list[str]:
    return sorted({r["district"] for r in get_recordings()})


def get_genders() -> list[str]:
    return sorted(_VALID_GENDERS)


def get_age_groups() -> list[str]:
    return list(_VALID_AGE_GROUPS)  # order preserved


ORDERED_AGE_GROUPS = ["under-18", "18-30", "31-50", "51+"]
