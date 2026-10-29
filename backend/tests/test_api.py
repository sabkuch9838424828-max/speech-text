"""Integration tests for FastAPI endpoints — updated for v0.2 schema."""
import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)
QS = "min_recordings=5&min_reference_words=20&high_wer_threshold=25"
QP = f"?{QS}"


class TestHealth:
    def test_health_ok(self):
        r = client.get("/api/health")
        assert r.status_code == 200
        assert r.json()["status"] == "ok"
        assert r.json()["data_label"] == "DEMO"


class TestDistricts:
    def test_returns_list(self):
        r = client.get("/api/districts")
        assert r.status_code == 200
        assert isinstance(r.json()["districts"], list)
        assert len(r.json()["districts"]) == 12  # 12 districts in new dataset

    def test_pune_present(self):
        assert "Pune" in client.get("/api/districts").json()["districts"]

    def test_bhojpur_present(self):
        assert "Bhojpur" in client.get("/api/districts").json()["districts"]


class TestSummaryStats:
    def test_returns_summary(self):
        r = client.get(f"/api/stats/summary?{QS}")
        assert r.status_code == 200
        d = r.json()
        assert d["total_districts"] == 12
        assert d["total_cohort_cells"] == 144   # 12×3×4
        assert d["blindspots"] > 50              # many gaps in demo data
        assert d["field_deficit_recordings"] > 0

    def test_all_required_fields(self):
        r = client.get(f"/api/stats/summary?{QS}")
        required = {
            "total_districts","total_cohort_cells","validated_cohorts","validated_pct",
            "high_wer_alerts","blindspots","blindspots_pct","field_deficit_recordings",
        }
        assert required.issubset(set(r.json().keys()))

    def test_threshold_sensitivity(self):
        """Higher min_recordings → fewer validated cohorts."""
        r_low  = client.get("/api/stats/summary?min_recordings=5&min_reference_words=20&high_wer_threshold=25")
        r_high = client.get("/api/stats/summary?min_recordings=10&min_reference_words=20&high_wer_threshold=25")
        assert r_low.json()["validated_cohorts"] >= r_high.json()["validated_cohorts"]


class TestWerOverview:
    def test_returns_12_districts(self):
        r = client.get(f"/api/wer/overview?{QS}")
        assert r.status_code == 200
        assert len(r.json()) == 12

    def test_no_data_has_null_wer_pct(self):
        for item in client.get(f"/api/wer/overview?{QS}").json():
            if item["status"] in ("no_data", "insufficient", "cannot_calculate"):
                assert item["wer_pct"] is None, (
                    f"{item['district']} has status {item['status']} but wer_pct={item['wer_pct']}"
                )

    def test_all_required_fields(self):
        required = {
            "district","status","wer_pct","recording_count",
            "reference_word_count","substitutions","deletions","insertions",
            "threshold_min_recordings","threshold_min_words",
        }
        for item in client.get(f"/api/wer/overview?{QS}").json():
            assert required.issubset(set(item.keys()))


class TestWerDetail:
    def test_valid_district(self):
        r = client.get(f"/api/wer/detail?district=Pune&{QS}")
        assert r.status_code == 200
        assert r.json()["district"] == "Pune"

    def test_unknown_district_404(self):
        assert client.get("/api/wer/detail?district=Atlantis").status_code == 404

    def test_gender_filter(self):
        r = client.get(f"/api/wer/detail?district=Pune&gender=female&{QS}")
        assert r.json()["gender"] == "female"

    def test_solapur_insufficient(self):
        """Solapur has only 2 recordings → insufficient or no_data."""
        r = client.get(f"/api/wer/detail?district=Solapur&{QS}")
        assert r.json()["status"] in ("insufficient", "no_data")
        assert r.json()["wer_pct"] is None

    def test_bastar_sparse(self):
        """Bastar has only 1 covered cell (male 18-30, 3 recs) → district-level insufficient."""
        r = client.get(f"/api/wer/detail?district=Bastar&{QS}")
        assert r.json()["status"] in ("insufficient", "no_data")


class TestWerCellDetail:
    def test_returns_naive_average(self):
        r = client.get(f"/api/wer/cell-detail?district=Pune&gender=female&age_group=18-30{QS[1:]}")
        assert r.status_code == 200
        d = r.json()
        assert "naive_average_wer_pct" in d
        # For evaluated cells, naive average should exist
        if d["status"] in ("ok", "high_wer"):
            assert d["naive_average_wer_pct"] is not None

    def test_no_data_cell_has_null_naive(self):
        # Bastar female 18-30 has no data
        r = client.get("/api/wer/cell-detail?district=Bastar&gender=female&age_group=18-30&min_recordings=5&min_reference_words=20&high_wer_threshold=25")
        assert r.json()["naive_average_wer_pct"] is None


class TestCoverageMatrix:
    def test_returns_cells(self):
        r = client.get(f"/api/coverage/matrix?{QS}")
        assert r.status_code == 200
        assert "cells" in r.json()
        assert len(r.json()["cells"]) == 144   # 12×3×4

    def test_cells_have_wer_fields(self):
        for cell in client.get(f"/api/coverage/matrix?{QS}").json()["cells"]:
            assert "wer_pct" in cell
            assert "substitutions" in cell
            assert "reference_word_count" in cell

    def test_no_data_cells_have_null_wer(self):
        for cell in client.get(f"/api/coverage/matrix?{QS}").json()["cells"]:
            if cell["status"] == "no_data":
                assert cell["wer_pct"] is None

    def test_ok_cells_have_wer_value(self):
        for cell in client.get(f"/api/coverage/matrix?{QS}").json()["cells"]:
            if cell["status"] == "ok":
                assert cell["wer_pct"] is not None

    def test_all_status_values_valid(self):
        valid = {"no_data", "insufficient", "ok", "high_wer", "cannot_calculate"}
        for cell in client.get(f"/api/coverage/matrix?{QS}").json()["cells"]:
            assert cell["status"] in valid

    def test_threshold_changes_classifications(self):
        low  = client.get("/api/coverage/matrix?min_recordings=5&min_reference_words=20&high_wer_threshold=25")
        high = client.get("/api/coverage/matrix?min_recordings=8&min_reference_words=20&high_wer_threshold=25")
        ok_low  = sum(1 for c in low.json()["cells"]  if c["status"] == "ok")
        ok_high = sum(1 for c in high.json()["cells"] if c["status"] == "ok")
        assert ok_low >= ok_high   # stricter threshold → fewer ok cells


class TestPriorities:
    def test_returns_priorities(self):
        r = client.get(f"/api/priorities?{QS}")
        assert r.status_code == 200
        assert "priorities" in r.json()
        assert "disclaimer" in r.json()

    def test_all_have_reason(self):
        for p in client.get(f"/api/priorities?{QS}").json()["priorities"]:
            assert p["reason"] and len(p["reason"]) > 20

    def test_missing_before_insufficient(self):
        order = {"missing": 0, "insufficient": 1, "high_wer": 2}
        types = [p["gap_type"] for p in client.get(f"/api/priorities?{QS}").json()["priorities"]]
        assert [order[t] for t in types] == sorted([order[t] for t in types])

    def test_demo_has_many_gaps(self):
        r = client.get(f"/api/priorities?{QS}")
        assert len(r.json()["priorities"]) > 80   # 97 blindspots alone


class TestCSVManifest:
    def test_returns_csv(self):
        r = client.get(f"/api/export/manifest?{QS}")
        assert r.status_code == 200
        assert "text/csv" in r.headers["content-type"]

    def test_csv_has_header(self):
        r = client.get(f"/api/export/manifest?{QS}")
        first_line = r.text.splitlines()[0]
        assert "district" in first_line
        assert "shortfall" in first_line


class TestOverrides:
    def test_submit_override(self):
        r = client.post("/api/overrides", json={
            "cell_id": "Bhojpur|female|51+",
            "reviewer_name": "Anjali Singh",
            "reviewer_role": "Field Linguist",
            "custom_target": 50,
            "qualitative_tag": "Halbi dialect — standard Hindi prompts not applicable",
            "notes": "Speakers use Halbi at home; need dialect-specific prompts.",
        })
        assert r.status_code == 200
        assert r.json()["accepted"] is True

    def test_empty_reviewer_rejected(self):
        r = client.post("/api/overrides", json={
            "cell_id": "x|y|z", "reviewer_name": "  ",
            "reviewer_role": "Researcher", "notes": "test",
        })
        assert r.status_code == 422

    def test_empty_notes_rejected(self):
        r = client.post("/api/overrides", json={
            "cell_id": "x|y|z", "reviewer_name": "Alice",
            "reviewer_role": "Researcher", "notes": "   ",
        })
        assert r.status_code == 422


class TestFeedbackLegacy:
    def test_submit_valid(self):
        r = client.post("/api/feedback", json={
            "cell_id": "Pune|female|18-30",
            "comment": "Needs more rural Pune recordings.",
            "reviewer": "Priya Patil",
        })
        assert r.status_code == 200
        assert r.json()["accepted"] is True

    def test_empty_comment_rejected(self):
        r = client.post("/api/feedback", json={
            "cell_id": "x", "comment": "  ", "reviewer": "Alice",
        })
        assert r.status_code == 422
