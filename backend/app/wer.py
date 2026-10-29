"""
Pure WER calculation logic.
WER = (substitutions + deletions + insertions) / reference_word_count * 100
Aggregation rule: sum all edit counts, then divide by sum of reference words.
Never impute a score for missing data.
"""

from __future__ import annotations
from dataclasses import dataclass
from enum import Enum
from typing import Optional


class WerStatus(str, Enum):
    NO_DATA = "no_data"
    INSUFFICIENT = "insufficient"
    CANNOT_CALCULATE = "cannot_calculate"
    HIGH_WER = "high_wer"
    OK = "ok"


@dataclass(frozen=True)
class EditCounts:
    substitutions: int
    deletions: int
    insertions: int
    reference_word_count: int

    def total_edits(self) -> int:
        return self.substitutions + self.deletions + self.insertions


@dataclass(frozen=True)
class WerResult:
    status: WerStatus
    wer_pct: Optional[float]          # None unless status is OK or HIGH_WER
    recording_count: int
    reference_word_count: int
    substitutions: int
    deletions: int
    insertions: int


def calculate_wer(
    substitutions: int,
    deletions: int,
    insertions: int,
    reference_word_count: int,
) -> Optional[float]:
    """
    Raw WER percentage. Returns None if reference_word_count is zero.
    Raises ValueError for negative counts.
    """
    if any(v < 0 for v in (substitutions, deletions, insertions, reference_word_count)):
        raise ValueError("Edit counts and reference word count must be non-negative.")
    if reference_word_count == 0:
        return None
    return (substitutions + deletions + insertions) / reference_word_count * 100.0


def aggregate_wer(
    records: list[EditCounts],
    *,
    min_recordings: int = 5,
    min_reference_words: int = 20,
    high_wer_threshold: float = 30.0,
) -> WerResult:
    """
    Aggregate WER from a list of EditCounts using summed edit counts.
    Never returns a WER score for empty or insufficient data.
    """
    # Exclude records with zero reference words from the calculation pool
    valid = [r for r in records if r.reference_word_count > 0]
    total_recordings = len(records)

    if total_recordings == 0:
        return WerResult(
            status=WerStatus.NO_DATA,
            wer_pct=None,
            recording_count=0,
            reference_word_count=0,
            substitutions=0,
            deletions=0,
            insertions=0,
        )

    total_ref_words = sum(r.reference_word_count for r in valid)
    total_subs = sum(r.substitutions for r in valid)
    total_dels = sum(r.deletions for r in valid)
    total_ins = sum(r.insertions for r in valid)

    if total_ref_words == 0:
        return WerResult(
            status=WerStatus.CANNOT_CALCULATE,
            wer_pct=None,
            recording_count=total_recordings,
            reference_word_count=0,
            substitutions=total_subs,
            deletions=total_dels,
            insertions=total_ins,
        )

    if (
        len(valid) < min_recordings
        or total_ref_words < min_reference_words
    ):
        return WerResult(
            status=WerStatus.INSUFFICIENT,
            wer_pct=None,
            recording_count=total_recordings,
            reference_word_count=total_ref_words,
            substitutions=total_subs,
            deletions=total_dels,
            insertions=total_ins,
        )

    wer = (total_subs + total_dels + total_ins) / total_ref_words * 100.0
    status = WerStatus.HIGH_WER if wer >= high_wer_threshold else WerStatus.OK

    return WerResult(
        status=status,
        wer_pct=round(wer, 2),
        recording_count=total_recordings,
        reference_word_count=total_ref_words,
        substitutions=total_subs,
        deletions=total_dels,
        insertions=total_ins,
    )
