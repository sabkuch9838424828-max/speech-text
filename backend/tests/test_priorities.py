"""
Tests for collection priority engine.
"""

import pytest
from app.priorities import get_priorities


class TestPriorities:
    def test_priorities_have_required_fields(self):
        data = get_priorities()
        for p in data["priorities"]:
            assert "rank" in p
            assert "district" in p
            assert "gender" in p
            assert "age_group" in p
            assert "reason" in p
            assert "gap_type" in p
            assert "recording_count" in p
            assert "recommended_target" in p

    def test_reason_is_human_readable(self):
        data = get_priorities()
        for p in data["priorities"]:
            assert len(p["reason"]) > 20, "Reason must be a real explanation"

    def test_gap_type_valid_values(self):
        data = get_priorities()
        valid_types = {"missing", "insufficient", "high_wer"}
        for p in data["priorities"]:
            assert p["gap_type"] in valid_types

    def test_ranks_are_sequential(self):
        data = get_priorities()
        ranks = [p["rank"] for p in data["priorities"]]
        assert ranks == list(range(1, len(ranks) + 1))

    def test_missing_before_insufficient_before_high_wer(self):
        data = get_priorities()
        _order = {"missing": 0, "insufficient": 1, "high_wer": 2}
        gap_types = [p["gap_type"] for p in data["priorities"]]
        ordered = [_order[g] for g in gap_types]
        assert ordered == sorted(ordered), "Missing should come before insufficient before high_wer"

    def test_disclaimer_present(self):
        data = get_priorities()
        assert len(data["disclaimer"]) > 50

    def test_thresholds_returned(self):
        data = get_priorities()
        assert "min_recordings" in data["thresholds"]
        assert "high_wer_threshold" in data["thresholds"]

    def test_demo_data_has_gaps(self):
        """Demo data should produce at least some priority recommendations."""
        data = get_priorities()
        assert len(data["priorities"]) > 0
