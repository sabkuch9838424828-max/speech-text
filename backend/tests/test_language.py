"""Tests for language distribution endpoints."""
import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_language_distribution_all():
    r = client.get("/api/language/distribution")
    assert r.status_code == 200
    data = r.json()
    assert "languages" in data
    assert data["data_label"] == "DEMO"
    assert data["total_recordings"] > 0
    assert data["unique_languages"] > 1


def test_language_distribution_fields():
    r = client.get("/api/language/distribution")
    langs = r.json()["languages"]
    assert len(langs) > 0
    first = langs[0]
    for field in ["language", "recording_count", "reference_word_count",
                  "substitutions", "deletions", "insertions",
                  "breakdown_by_age", "breakdown_by_district"]:
        assert field in first, f"Missing field: {field}"


def test_language_distribution_wer_integrity():
    """WER must be None when ref words == 0, never invented."""
    r = client.get("/api/language/distribution")
    for lang in r.json()["languages"]:
        if lang["reference_word_count"] == 0:
            assert lang["wer_pct"] is None, "WER must be None when ref_words=0"
        else:
            assert lang["wer_pct"] is not None
            assert 0 <= lang["wer_pct"] <= 100


def test_language_distribution_by_district():
    r = client.get("/api/language/distribution?district=Pune")
    assert r.status_code == 200
    data = r.json()
    assert data["filters_applied"]["district"] == "Pune"
    # Pune should have Marathi as a language
    langs = [l["language"] for l in data["languages"]]
    assert "Marathi" in langs


def test_language_distribution_by_age():
    r = client.get("/api/language/distribution?age_group=51%2B")
    assert r.status_code == 200
    data = r.json()
    assert data["filters_applied"]["age_group"] == "51+"
    assert data["total_recordings"] > 0


def test_language_distribution_age_breakdown():
    r = client.get("/api/language/distribution")
    for lang in r.json()["languages"]:
        for age, b in lang["breakdown_by_age"].items():
            assert "recording_count" in b
            assert "wer_pct" in b
            assert b["recording_count"] > 0


def test_language_distribution_unknown_district():
    r = client.get("/api/language/distribution?district=Nonexistent")
    assert r.status_code == 200
    data = r.json()
    assert data["total_recordings"] == 0
    assert data["languages"] == []


def test_language_matrix():
    r = client.get("/api/language/matrix")
    assert r.status_code == 200
    data = r.json()
    assert "cells" in data
    assert "districts" in data
    assert "languages" in data
    assert "age_groups" in data
    assert data["data_label"] == "DEMO"
    assert len(data["cells"]) > 0


def test_language_matrix_cell_fields():
    r = client.get("/api/language/matrix")
    for cell in r.json()["cells"][:5]:
        for f in ["district", "language", "age_group", "recording_count"]:
            assert f in cell


def test_language_matrix_wer_integrity():
    r = client.get("/api/language/matrix")
    for cell in r.json()["cells"]:
        if cell["reference_word_count"] == 0:
            assert cell["wer_pct"] is None
        elif cell["wer_pct"] is not None:
            assert 0 <= cell["wer_pct"] <= 100


def test_multiple_languages_per_district():
    """Each major district should have at least 2 languages in demo data."""
    r = client.get("/api/language/matrix")
    data = r.json()
    from collections import Counter
    dist_langs = Counter((c["district"], c["language"]) for c in data["cells"])
    langs_per_district = Counter()
    for (dist, _lang) in dist_langs:
        langs_per_district[dist] += 1
    # At least half of districts should have 2+ languages
    multi = sum(1 for v in langs_per_district.values() if v >= 2)
    assert multi >= 4, f"Expected 4+ multi-language districts, got {multi}"
