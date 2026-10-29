"""Tests for the enriched coverage matrix."""
import pytest
from app.coverage import build_coverage_matrix, get_summary_stats
from app.data_loader import ORDERED_AGE_GROUPS

_ALL_GENDERS = ["female", "male", "other"]


class TestCoverageMatrix:
    def test_144_cells_total(self):
        data = build_coverage_matrix(min_recordings=5, min_reference_words=20, high_wer_threshold=25)
        assert len(data["cells"]) == 144   # 12 × 3 × 4

    def test_all_expected_combinations_present(self):
        data = build_coverage_matrix(min_recordings=5, min_reference_words=20, high_wer_threshold=25)
        districts = data["districts"]
        expected = {(d, g, a) for d in districts for g in _ALL_GENDERS for a in ORDERED_AGE_GROUPS}
        actual   = {(c["district"], c["gender"], c["age_group"]) for c in data["cells"]}
        assert expected == actual

    def test_no_data_cells_have_null_wer(self):
        data = build_coverage_matrix(min_recordings=5, min_reference_words=20, high_wer_threshold=25)
        for cell in data["cells"]:
            if cell["status"] == "no_data":
                assert cell["wer_pct"] is None
                assert cell["recording_count"] == 0

    def test_ok_cells_have_wer(self):
        data = build_coverage_matrix(min_recordings=5, min_reference_words=20, high_wer_threshold=25)
        ok_cells = [c for c in data["cells"] if c["status"] == "ok"]
        assert len(ok_cells) > 0
        for cell in ok_cells:
            assert cell["wer_pct"] is not None
            assert cell["wer_pct"] < 25   # below threshold

    def test_high_wer_cells_flagged(self):
        data = build_coverage_matrix(min_recordings=5, min_reference_words=20, high_wer_threshold=25)
        hw = [c for c in data["cells"] if c["status"] == "high_wer"]
        assert len(hw) > 0
        for cell in hw:
            assert cell["wer_pct"] is not None
            assert cell["wer_pct"] >= 25

    def test_insufficient_below_threshold(self):
        data = build_coverage_matrix(min_recordings=5, min_reference_words=20, high_wer_threshold=25)
        for cell in data["cells"]:
            if cell["status"] == "insufficient":
                assert 0 < cell["recording_count"] < 5

    def test_threshold_sensitivity(self):
        """Moving min_recordings from 5 → 8 must reclassify some ok→insufficient."""
        d5 = build_coverage_matrix(min_recordings=5, min_reference_words=20, high_wer_threshold=25)
        d8 = build_coverage_matrix(min_recordings=8, min_reference_words=20, high_wer_threshold=25)
        ok5 = sum(1 for c in d5["cells"] if c["status"] == "ok")
        ok8 = sum(1 for c in d8["cells"] if c["status"] == "ok")
        assert ok5 >= ok8

    def test_bhojpur_female_51_is_high_wer(self):
        """Bhojpur female 51+ was designed with 38% WER."""
        data = build_coverage_matrix(min_recordings=5, min_reference_words=20, high_wer_threshold=25)
        cell = next(c for c in data["cells"]
                    if c["district"]=="Bhojpur" and c["gender"]=="female" and c["age_group"]=="51+")
        assert cell["status"] == "high_wer"
        assert cell["wer_pct"] >= 25


class TestSummaryStats:
    def test_12_districts(self):
        s = get_summary_stats(min_recordings=5, min_reference_words=20, high_wer_threshold=25)
        assert s["total_districts"] == 12

    def test_144_cells(self):
        s = get_summary_stats(min_recordings=5, min_reference_words=20, high_wer_threshold=25)
        assert s["total_cohort_cells"] == 144

    def test_majority_are_blindspots(self):
        s = get_summary_stats(min_recordings=5, min_reference_words=20, high_wer_threshold=25)
        assert s["blindspots"] > 70   # 97 expected

    def test_percentages_sum_coherent(self):
        s = get_summary_stats(min_recordings=5, min_reference_words=20, high_wer_threshold=25)
        accounted = (s["validated_cohorts"] + s["high_wer_alerts"]
                     + s["blindspots"] + s["insufficient_evidence"] + s["cannot_calculate"])
        assert accounted == s["total_cohort_cells"]

    def test_field_deficit_positive(self):
        s = get_summary_stats(min_recordings=5, min_reference_words=20, high_wer_threshold=25)
        assert s["field_deficit_recordings"] > 500
