"""
Language distribution analysis for BhashaLens.
Computes recording counts and WER breakdowns by language,
sliced by district and age group.
⚠ All data is ILLUSTRATIVE DEMO DATA.
"""
from __future__ import annotations
from collections import defaultdict
from typing import Optional
from app.data_loader import get_recordings, ORDERED_AGE_GROUPS


def get_language_distribution(
    district: Optional[str] = None,
    gender: Optional[str] = None,
    age_group: Optional[str] = None,
) -> dict:
    """
    Returns language distribution across the filtered scope.

    Each entry contains:
      - language
      - recording_count
      - reference_word_count
      - substitutions, deletions, insertions
      - wer_pct (None if ref words == 0)
      - breakdown_by_age: {age_group: {count, wer_pct}}
      - breakdown_by_district: {district: {count, wer_pct}}
    """
    recs = get_recordings()

    # Apply filters
    if district:
        recs = [r for r in recs if r["district"] == district]
    if gender:
        recs = [r for r in recs if r["gender"] == gender]
    if age_group:
        recs = [r for r in recs if r["age_group"] == age_group]

    # Aggregate by language
    lang_totals: dict[str, dict] = defaultdict(lambda: {
        "recording_count": 0,
        "reference_word_count": 0,
        "substitutions": 0,
        "deletions": 0,
        "insertions": 0,
    })
    # age breakdown: lang → age_group → {count, s, d, i, words}
    lang_age: dict[str, dict[str, dict]] = defaultdict(
        lambda: defaultdict(lambda: {"count": 0, "words": 0, "s": 0, "d": 0, "i": 0})
    )
    # district breakdown: lang → district → {count, s, d, i, words}
    lang_dist: dict[str, dict[str, dict]] = defaultdict(
        lambda: defaultdict(lambda: {"count": 0, "words": 0, "s": 0, "d": 0, "i": 0})
    )

    for r in recs:
        lang = r.get("language") or "Unknown"
        ag = r["age_group"]
        di = r["district"]
        s, d, i, w = r["substitutions"], r["deletions"], r["insertions"], r["reference_word_count"]

        t = lang_totals[lang]
        t["recording_count"] += 1
        t["reference_word_count"] += w
        t["substitutions"] += s
        t["deletions"] += d
        t["insertions"] += i

        la = lang_age[lang][ag]
        la["count"] += 1
        la["words"] += w
        la["s"] += s
        la["d"] += d
        la["i"] += i

        ld = lang_dist[lang][di]
        ld["count"] += 1
        ld["words"] += w
        ld["s"] += s
        ld["d"] += d
        ld["i"] += i

    def wer(s, d, i, w):
        if w == 0:
            return None
        return round((s + d + i) / w * 100, 1)

    result = []
    for lang, t in sorted(lang_totals.items()):
        age_breakdown = {}
        for ag in ORDERED_AGE_GROUPS:
            if ag in lang_age[lang]:
                b = lang_age[lang][ag]
                age_breakdown[ag] = {
                    "recording_count": b["count"],
                    "wer_pct": wer(b["s"], b["d"], b["i"], b["words"]),
                    "reference_word_count": b["words"],
                    "substitutions": b["s"],
                    "deletions": b["d"],
                    "insertions": b["i"],
                }

        dist_breakdown = {}
        for di, b in sorted(lang_dist[lang].items()):
            dist_breakdown[di] = {
                "recording_count": b["count"],
                "wer_pct": wer(b["s"], b["d"], b["i"], b["words"]),
            }

        result.append({
            "language": lang,
            "recording_count": t["recording_count"],
            "reference_word_count": t["reference_word_count"],
            "substitutions": t["substitutions"],
            "deletions": t["deletions"],
            "insertions": t["insertions"],
            "wer_pct": wer(t["substitutions"], t["deletions"], t["insertions"], t["reference_word_count"]),
            "breakdown_by_age": age_breakdown,
            "breakdown_by_district": dist_breakdown,
        })

    # Sort by recording_count descending
    result.sort(key=lambda x: x["recording_count"], reverse=True)
    return {
        "languages": result,
        "total_recordings": sum(t["recording_count"] for t in lang_totals.values()),
        "unique_languages": len(lang_totals),
        "filters_applied": {
            "district": district,
            "gender": gender,
            "age_group": age_group,
        },
        "data_label": "DEMO",
    }


def get_district_language_matrix() -> dict:
    """
    Returns a district × language × age_group matrix for the heatmap view.
    Each cell: {recording_count, wer_pct}
    """
    recs = get_recordings()

    # Collect all unique values
    all_districts = sorted({r["district"] for r in recs})
    all_languages = sorted({r.get("language") or "Unknown" for r in recs})
    all_ages = [ag for ag in ORDERED_AGE_GROUPS if ag in {r["age_group"] for r in recs}]

    # Aggregate: district → language → age → {count, words, s, d, i}
    matrix: dict = defaultdict(lambda: defaultdict(lambda: defaultdict(
        lambda: {"count": 0, "words": 0, "s": 0, "d": 0, "i": 0}
    )))

    for r in recs:
        lang = r.get("language") or "Unknown"
        cell = matrix[r["district"]][lang][r["age_group"]]
        cell["count"] += 1
        cell["words"] += r["reference_word_count"]
        cell["s"] += r["substitutions"]
        cell["d"] += r["deletions"]
        cell["i"] += r["insertions"]

    def wer(c):
        if c["words"] == 0:
            return None
        return round((c["s"] + c["d"] + c["i"]) / c["words"] * 100, 1)

    cells = []
    for district in all_districts:
        for language in all_languages:
            for age in all_ages:
                c = matrix[district][language][age]
                if c["count"] > 0:
                    cells.append({
                        "district": district,
                        "language": language,
                        "age_group": age,
                        "recording_count": c["count"],
                        "wer_pct": wer(c),
                        "reference_word_count": c["words"],
                        "substitutions": c["s"],
                        "deletions": c["d"],
                        "insertions": c["i"],
                    })

    return {
        "cells": cells,
        "districts": all_districts,
        "languages": all_languages,
        "age_groups": all_ages,
        "data_label": "DEMO",
    }
