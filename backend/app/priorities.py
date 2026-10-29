"""
Collection priority engine.
Ranks gaps in coverage to guide communities on which recordings to collect next.
Priorities are recommendations, not automatic decisions — the community review
step must confirm or override them.
"""

from __future__ import annotations
from app.coverage import build_coverage_matrix
from app.aggregator import get_wer_for_group, DEFAULT_HIGH_WER_THRESHOLD, DEFAULT_MIN_RECORDINGS
from app.wer import WerStatus

_RECOMMENDED_TARGET = 10   # target recordings per cell


def _make_reason(gap_type: str, district: str, gender: str, age_group: str, count: int) -> str:
    if gap_type == "missing":
        return (
            f"No recordings exist for {district} / {gender} / {age_group}. "
            f"This group is completely absent from the evaluation data."
        )
    if gap_type == "insufficient":
        return (
            f"Only {count} recording(s) found for {district} / {gender} / {age_group}. "
            f"A minimum of {DEFAULT_MIN_RECORDINGS} recordings with adequate word coverage "
            f"is required before a reliable WER can be computed."
        )
    if gap_type == "high_wer":
        return (
            f"{district} / {gender} / {age_group} has a high WER (≥{DEFAULT_HIGH_WER_THRESHOLD}%). "
            f"Additional recordings may help verify whether this reflects genuine recognition "
            f"difficulty or sample bias. Community review is recommended before drawing conclusions."
        )
    return "Unknown gap type."


def get_priorities(
    min_recordings: int = DEFAULT_MIN_RECORDINGS,
    high_wer_threshold: float = DEFAULT_HIGH_WER_THRESHOLD,
) -> dict:
    matrix = build_coverage_matrix(min_recordings=min_recordings)

    priorities = []

    for cell in matrix["cells"]:
        district = cell["district"]
        gender = cell["gender"]
        age_group = cell["age_group"]
        count = cell["recording_count"]
        cell_status = cell["status"]

        if cell_status == "no_data":
            gap_type = "missing"
        elif cell_status == "insufficient":
            gap_type = "insufficient"
        else:
            # Has enough recordings — check WER
            wer_result = get_wer_for_group(
                district=district,
                gender=gender,
                age_group=age_group,
                min_recordings=min_recordings,
                high_wer_threshold=high_wer_threshold,
            )
            if wer_result.status == WerStatus.HIGH_WER:
                gap_type = "high_wer"
            else:
                continue  # no gap

        priorities.append({
            "district": district,
            "gender": gender,
            "age_group": age_group,
            "gap_type": gap_type,
            "recording_count": count,
            "reason": _make_reason(gap_type, district, gender, age_group, count),
            "recommended_target": _RECOMMENDED_TARGET,
        })

    # Sort: missing first, then insufficient, then high_wer; within each group by count asc
    _order = {"missing": 0, "insufficient": 1, "high_wer": 2}
    priorities.sort(key=lambda p: (_order[p["gap_type"]], p["recording_count"]))

    # Add rank
    for i, p in enumerate(priorities, start=1):
        p["rank"] = i

    return {
        "priorities": priorities,
        "thresholds": {
            "min_recordings": min_recordings,
            "high_wer_threshold": high_wer_threshold,
            "recommended_target": _RECOMMENDED_TARGET,
        },
        "disclaimer": (
            "These priorities are data-driven recommendations based on illustrative demo data. "
            "They must be reviewed and confirmed by community stakeholders before any "
            "collection campaigns are initiated. Demographic patterns alone do not imply "
            "causes for recognition errors."
        ),
    }
