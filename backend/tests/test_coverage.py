"""
Tests for coverage matrix builder.
"""

import pytest
from app.coverage import build_coverage_matrix
from app.data_loader import ORDERED_AGE_GROUPS

_ALL_GENDERS = ["female", "male", "other"]


class TestCoverageMatrix:
    def test_all_expected_combinations_present(self):
        """Every district × gender × age_group combo must appear in the matrix."""
        data = build_coverage_matrix()
        cells = data["cells"]
        districts = data["districts"]

        expected_combos = {
            (d, g, a)
            for d in districts
            for g in _ALL_GENDERS
            for a in ORDERED_AGE_GROUPS
        }
        actual_combos = {(c["district"], c["gender"], c["age_group"]) for c in cells}
        assert expected_combos == actual_combos

    def test_missing_combos_have_no_data_status(self):
        """Cells with 0 recordings must be labelled 'no_data', not '0% WER'."""
        data = build_coverage_matrix()
        no_data_cells = [c for c in data["cells"] if c["status"] == "no_data"]
        assert len(no_data_cells) > 0  # demo data definitely has gaps
        for cell in no_data_cells:
            assert cell["recording_count"] == 0

    def test_insufficient_cells_below_threshold(self):
        data = build_coverage_matrix(min_recordings=5)
        for cell in data["cells"]:
            if cell["status"] == "insufficient":
                assert 0 < cell["recording_count"] < 5

    def test_ok_cells_meet_threshold(self):
        data = build_coverage_matrix(min_recordings=5)
        for cell in data["cells"]:
            if cell["status"] == "ok":
                assert cell["recording_count"] >= 5

    def test_known_district_present(self):
        data = build_coverage_matrix()
        assert "Pune" in data["districts"]

    def test_matrix_has_all_genders(self):
        data = build_coverage_matrix()
        assert set(data["genders"]) == {"female", "male", "other"}

    def test_matrix_has_all_age_groups(self):
        data = build_coverage_matrix()
        assert data["age_groups"] == ORDERED_AGE_GROUPS

    def test_recording_count_non_negative(self):
        data = build_coverage_matrix()
        for cell in data["cells"]:
            assert cell["recording_count"] >= 0
