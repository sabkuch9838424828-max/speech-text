"""
Builds the evidence coverage matrix:
For every expected (district × gender × age_group) cell,
show how many recordings exist and whether the cell has enough evidence.
"""

from __future__ import annotations
from app.data_loader import get_recordings, get_districts, ORDERED_AGE_GROUPS
from app.aggregator import DEFAULT_MIN_RECORDINGS

_ALL_GENDERS = ["female", "male", "other"]


def build_coverage_matrix(
    min_recordings: int = DEFAULT_MIN_RECORDINGS,
) -> dict:
    recordings = get_recordings()
    districts = get_districts()

    # Count recordings per cell
    counts: dict[tuple[str, str, str], int] = {}
    for rec in recordings:
        key = (rec["district"], rec["gender"], rec["age_group"])
        counts[key] = counts.get(key, 0) + 1

    cells = []
    for district in districts:
        for gender in _ALL_GENDERS:
            for age_group in ORDERED_AGE_GROUPS:
                count = counts.get((district, gender, age_group), 0)
                if count == 0:
                    status = "no_data"
                elif count < min_recordings:
                    status = "insufficient"
                else:
                    status = "ok"
                cells.append({
                    "district": district,
                    "gender": gender,
                    "age_group": age_group,
                    "status": status,
                    "recording_count": count,
                })

    return {
        "cells": cells,
        "districts": districts,
        "genders": _ALL_GENDERS,
        "age_groups": ORDERED_AGE_GROUPS,
    }
