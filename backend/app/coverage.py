"""
Builds the enriched evidence coverage matrix.
Each cell includes WER result + counts so the frontend can render
inline WER values without extra round-trips.
"""
from __future__ import annotations
from app.data_loader import get_recordings, get_districts, ORDERED_AGE_GROUPS
from app.aggregator import (
    _to_edit_counts,
    DEFAULT_MIN_RECORDINGS,
    DEFAULT_MIN_REFERENCE_WORDS,
    DEFAULT_HIGH_WER_THRESHOLD,
)
from app.wer import aggregate_wer

_ALL_GENDERS = ["female", "male", "other"]


def build_coverage_matrix(
    min_recordings: int = DEFAULT_MIN_RECORDINGS,
    min_reference_words: int = DEFAULT_MIN_REFERENCE_WORDS,
    high_wer_threshold: float = DEFAULT_HIGH_WER_THRESHOLD,
) -> dict:
    recordings = get_recordings()
    districts = get_districts()

    # Group recordings by (district, gender, age_group)
    groups: dict[tuple, list[dict]] = {}
    for rec in recordings:
        key = (rec["district"], rec["gender"], rec["age_group"])
        groups.setdefault(key, []).append(rec)

    cells = []
    for district in districts:
        for gender in _ALL_GENDERS:
            for age_group in ORDERED_AGE_GROUPS:
                key = (district, gender, age_group)
                recs_for_cell = groups.get(key, [])
                counts = [_to_edit_counts(r) for r in recs_for_cell]

                result = aggregate_wer(
                    counts,
                    min_recordings=min_recordings,
                    min_reference_words=min_reference_words,
                    high_wer_threshold=high_wer_threshold,
                )

                cells.append({
                    "district":             district,
                    "gender":               gender,
                    "age_group":            age_group,
                    "status":               result.status.value,
                    "recording_count":      result.recording_count,
                    "wer_pct":              result.wer_pct,
                    "reference_word_count": result.reference_word_count,
                    "substitutions":        result.substitutions,
                    "deletions":            result.deletions,
                    "insertions":           result.insertions,
                })

    return {
        "cells":      cells,
        "districts":  districts,
        "genders":    _ALL_GENDERS,
        "age_groups": ORDERED_AGE_GROUPS,
    }


def get_summary_stats(
    min_recordings: int = DEFAULT_MIN_RECORDINGS,
    min_reference_words: int = DEFAULT_MIN_REFERENCE_WORDS,
    high_wer_threshold: float = DEFAULT_HIGH_WER_THRESHOLD,
    recommended_target: int = 10,
) -> dict:
    matrix = build_coverage_matrix(
        min_recordings=min_recordings,
        min_reference_words=min_reference_words,
        high_wer_threshold=high_wer_threshold,
    )
    cells = matrix["cells"]
    total_cells = len(cells)
    validated   = sum(1 for c in cells if c["status"] == "ok")
    high_wer    = sum(1 for c in cells if c["status"] == "high_wer")
    no_data     = sum(1 for c in cells if c["status"] == "no_data")
    insufficient = sum(1 for c in cells if c["status"] == "insufficient")
    cannot_calc  = sum(1 for c in cells if c["status"] == "cannot_calculate")

    field_deficit = sum(
        max(0, recommended_target - c["recording_count"])
        for c in cells
        if c["status"] != "ok"
    )

    return {
        "total_districts":           len(matrix["districts"]),
        "total_cohort_cells":        total_cells,
        "validated_cohorts":         validated,
        "validated_pct":             round(validated / total_cells * 100, 1) if total_cells else 0,
        "high_wer_alerts":           high_wer,
        "high_wer_pct":              round(high_wer / total_cells * 100, 1) if total_cells else 0,
        "blindspots":                no_data,
        "blindspots_pct":            round(no_data / total_cells * 100, 1) if total_cells else 0,
        "insufficient_evidence":     insufficient,
        "cannot_calculate":          cannot_calc,
        "field_deficit_recordings":  field_deficit,
        "recommended_target_per_cell": recommended_target,
    }
