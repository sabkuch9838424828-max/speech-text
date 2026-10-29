"""Collection priority engine."""
from __future__ import annotations
from app.coverage import build_coverage_matrix
from app.aggregator import (
    get_wer_for_group,
    DEFAULT_HIGH_WER_THRESHOLD,
    DEFAULT_MIN_RECORDINGS,
    DEFAULT_MIN_REFERENCE_WORDS,
)
from app.wer import WerStatus

_RECOMMENDED_TARGET = 10


def _make_reason(gap_type: str, district: str, gender: str, age_group: str, count: int, min_rec: int) -> str:
    if gap_type == "missing":
        return (
            f"No recordings exist for {district} / {gender} / {age_group}. "
            "This demographic slice is completely absent from the evaluation corpus."
        )
    if gap_type == "insufficient":
        return (
            f"Only {count} recording(s) found for {district} / {gender} / {age_group}. "
            f"At least {min_rec} recordings with adequate word coverage are required "
            "before a statistically reliable WER can be computed."
        )
    if gap_type == "high_wer":
        return (
            f"{district} / {gender} / {age_group} has a high WER. "
            "Additional diverse recordings may help verify whether this reflects genuine "
            "recognition difficulty or sample bias. Community review is recommended "
            "before drawing conclusions about model performance."
        )
    return "Unknown gap type."


def get_priorities(
    min_recordings: int = DEFAULT_MIN_RECORDINGS,
    min_reference_words: int = DEFAULT_MIN_REFERENCE_WORDS,
    high_wer_threshold: float = DEFAULT_HIGH_WER_THRESHOLD,
) -> dict:
    matrix = build_coverage_matrix(
        min_recordings=min_recordings,
        min_reference_words=min_reference_words,
        high_wer_threshold=high_wer_threshold,
    )

    priorities = []
    for cell in matrix["cells"]:
        district  = cell["district"]
        gender    = cell["gender"]
        age_group = cell["age_group"]
        count     = cell["recording_count"]
        status    = cell["status"]

        if status == "no_data":
            gap_type = "missing"
        elif status in ("insufficient", "cannot_calculate"):
            gap_type = "insufficient"
        elif status == "high_wer":
            gap_type = "high_wer"
        else:
            continue  # ok — no gap

        priorities.append({
            "district":           district,
            "gender":             gender,
            "age_group":          age_group,
            "gap_type":           gap_type,
            "recording_count":    count,
            "reason":             _make_reason(gap_type, district, gender, age_group, count, min_recordings),
            "recommended_target": _RECOMMENDED_TARGET,
        })

    _order = {"missing": 0, "insufficient": 1, "high_wer": 2}
    priorities.sort(key=lambda p: (_order[p["gap_type"]], p["recording_count"]))

    for i, p in enumerate(priorities, start=1):
        p["rank"] = i

    return {
        "priorities": priorities,
        "thresholds": {
            "min_recordings":      min_recordings,
            "min_reference_words": min_reference_words,
            "high_wer_threshold":  high_wer_threshold,
            "recommended_target":  _RECOMMENDED_TARGET,
        },
        "disclaimer": (
            "These priorities are data-driven recommendations based on illustrative demo data. "
            "They must be reviewed and confirmed by community stakeholders before any "
            "collection campaigns are initiated. Demographic patterns alone do not imply "
            "causes for recognition errors."
        ),
    }
