"""
Integration tests for FastAPI endpoints.
Tests enforce the API contract: no wer_pct for no_data/insufficient,
all required fields present, correct status codes.
"""

import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


class TestHealth:
    def test_health_ok(self):
        resp = client.get("/api/health")
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "ok"
        assert data["data_label"] == "DEMO"


class TestDistricts:
    def test_returns_list(self):
        resp = client.get("/api/districts")
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data["districts"], list)
        assert len(data["districts"]) > 0

    def test_pune_present(self):
        resp = client.get("/api/districts")
        assert "Pune" in resp.json()["districts"]


class TestWerOverview:
    def test_returns_list(self):
        resp = client.get("/api/wer/overview")
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)

    def test_no_data_has_null_wer_pct(self):
        """WER status no_data and insufficient must NEVER have a wer_pct."""
        resp = client.get("/api/wer/overview")
        for item in resp.json():
            if item["status"] in ("no_data", "insufficient"):
                assert item["wer_pct"] is None, (
                    f"District {item['district']} has status {item['status']} "
                    f"but wer_pct={item['wer_pct']} — must be null"
                )

    def test_all_required_fields_present(self):
        resp = client.get("/api/wer/overview")
        required = {
            "district", "status", "wer_pct", "recording_count",
            "reference_word_count", "substitutions", "deletions",
            "insertions", "threshold_min_recordings", "threshold_min_words",
        }
        for item in resp.json():
            assert required.issubset(set(item.keys()))

    def test_threshold_params_accepted(self):
        resp = client.get("/api/wer/overview?min_recordings=3&min_reference_words=10&high_wer_threshold=20")
        assert resp.status_code == 200


class TestWerDetail:
    def test_valid_district(self):
        resp = client.get("/api/wer/detail?district=Pune")
        assert resp.status_code == 200
        data = resp.json()
        assert data["district"] == "Pune"

    def test_unknown_district_404(self):
        resp = client.get("/api/wer/detail?district=NonExistentDistrict99")
        assert resp.status_code == 404

    def test_gender_filter(self):
        resp = client.get("/api/wer/detail?district=Pune&gender=female")
        assert resp.status_code == 200
        data = resp.json()
        assert data["gender"] == "female"

    def test_age_group_filter(self):
        resp = client.get("/api/wer/detail?district=Pune&age_group=18-30")
        assert resp.status_code == 200
        data = resp.json()
        assert data["age_group"] == "18-30"

    def test_no_wer_for_insufficient(self):
        """Solapur has only 2 recordings (below default threshold of 5)."""
        resp = client.get("/api/wer/detail?district=Solapur")
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] in ("insufficient", "no_data", "cannot_calculate")
        assert data["wer_pct"] is None


class TestCoverageMatrix:
    def test_returns_cells(self):
        resp = client.get("/api/coverage/matrix")
        assert resp.status_code == 200
        data = resp.json()
        assert "cells" in data
        assert len(data["cells"]) > 0

    def test_all_status_values_valid(self):
        resp = client.get("/api/coverage/matrix")
        valid = {"no_data", "insufficient", "ok"}
        for cell in resp.json()["cells"]:
            assert cell["status"] in valid


class TestPriorities:
    def test_returns_priorities(self):
        resp = client.get("/api/priorities")
        assert resp.status_code == 200
        data = resp.json()
        assert "priorities" in data
        assert "disclaimer" in data

    def test_all_priorities_have_reason(self):
        resp = client.get("/api/priorities")
        for p in resp.json()["priorities"]:
            assert p["reason"] and len(p["reason"]) > 10


class TestFeedback:
    def test_submit_valid_feedback(self):
        resp = client.post("/api/feedback", json={
            "cell_id": "Pune|female|18-30",
            "comment": "This group needs more recordings from rural Pune.",
            "reviewer": "Priya Patil",
            "agreed_with_priority": True,
        })
        assert resp.status_code == 200
        data = resp.json()
        assert data["accepted"] is True
        assert "Priya Patil" in data["message"]

    def test_empty_comment_rejected(self):
        resp = client.post("/api/feedback", json={
            "cell_id": "Pune|female|18-30",
            "comment": "   ",
            "reviewer": "Priya Patil",
        })
        assert resp.status_code == 422

    def test_empty_reviewer_rejected(self):
        resp = client.post("/api/feedback", json={
            "cell_id": "Pune|female|18-30",
            "comment": "Some comment",
            "reviewer": "   ",
        })
        assert resp.status_code == 422
