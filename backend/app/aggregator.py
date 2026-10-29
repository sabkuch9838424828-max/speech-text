"""
Aggregates recordings into WerResult objects using the correct
summed-edit-counts formula. Applies filters and threshold classification.
"""

from __future__ import annotations
from typing import Optional
from app.wer import EditCounts, WerResult, aggregate_wer
from app.data_loader import get_recordings, get_districts, ORDERED_AGE_GROUPS

# Default thresholds — exposed to API callers
DEFAULT_MIN_RECORDINGS = 5
DEFAULT_MIN_REFERENCE_WORDS = 20
DEFAULT_HIGH_WER_THRESHOLD = 30.0


def _to_edit_counts(rec: dict) -> EditCounts:
    return EditCounts(
        substitutions=rec["substitutions"],
        deletions=rec["deletions"],
        insertions=rec["insertions"],
        reference_word_count=rec["reference_word_count"],
    )


def filter_recordings(
    recordings: list[dict],
    *,
    district: Optional[str] = None,
    gender: Optional[str] = None,
    age_group: Optional[str] = None,
) -> list[dict]:
    result = recordings
    if district:
        result = [r for r in result if r["district"] == district]
    if gender:
        result = [r for r in result if r["gender"] == gender]
    if age_group:
        result = [r for r in result if r["age_group"] == age_group]
    return result


def get_wer_for_group(
    *,
    district: Optional[str] = None,
    gender: Optional[str] = None,
    age_group: Optional[str] = None,
    min_recordings: int = DEFAULT_MIN_RECORDINGS,
    min_reference_words: int = DEFAULT_MIN_REFERENCE_WORDS,
    high_wer_threshold: float = DEFAULT_HIGH_WER_THRESHOLD,
) -> WerResult:
    recordings = get_recordings()
    filtered = filter_recordings(recordings, district=district, gender=gender, age_group=age_group)
    counts = [_to_edit_counts(r) for r in filtered]
    return aggregate_wer(
        counts,
        min_recordings=min_recordings,
        min_reference_words=min_reference_words,
        high_wer_threshold=high_wer_threshold,
    )


def get_overview(
    min_recordings: int = DEFAULT_MIN_RECORDINGS,
    min_reference_words: int = DEFAULT_MIN_REFERENCE_WORDS,
    high_wer_threshold: float = DEFAULT_HIGH_WER_THRESHOLD,
) -> list[dict]:
    """
    Returns one WerResult per district (aggregated across all gender/age).
    """
    results = []
    for district in get_districts():
        wer_result = get_wer_for_group(
            district=district,
            min_recordings=min_recordings,
            min_reference_words=min_reference_words,
            high_wer_threshold=high_wer_threshold,
        )
        results.append({"district": district, "result": wer_result})
    return results
