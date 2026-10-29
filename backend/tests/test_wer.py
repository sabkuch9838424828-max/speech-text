"""
Tests for WER calculation — unit tests for calculate_wer and aggregate_wer.
"""

import pytest
from app.wer import calculate_wer, aggregate_wer, EditCounts, WerStatus


# ---------------------------------------------------------------------------
# calculate_wer
# ---------------------------------------------------------------------------

class TestCalculateWer:
    def test_perfect_recognition(self):
        assert calculate_wer(0, 0, 0, 4) == pytest.approx(0.0)

    def test_all_edits(self):
        # (1+1+1)/6 * 100 = 50.0
        assert calculate_wer(1, 1, 1, 6) == pytest.approx(50.0)

    def test_substitution_only(self):
        # 1/4 * 100 = 25.0
        assert calculate_wer(1, 0, 0, 4) == pytest.approx(25.0)

    def test_deletion_only(self):
        assert calculate_wer(0, 2, 0, 4) == pytest.approx(50.0)

    def test_insertion_only(self):
        assert calculate_wer(0, 0, 3, 6) == pytest.approx(50.0)

    def test_zero_reference_words_returns_none(self):
        """Cannot calculate WER when reference word count is zero."""
        assert calculate_wer(0, 0, 0, 0) is None
        assert calculate_wer(1, 2, 3, 0) is None

    def test_wer_over_100_is_valid(self):
        """WER can exceed 100% with many insertions."""
        result = calculate_wer(0, 0, 10, 5)
        assert result == pytest.approx(200.0)

    def test_negative_counts_raise(self):
        with pytest.raises(ValueError):
            calculate_wer(-1, 0, 0, 4)
        with pytest.raises(ValueError):
            calculate_wer(0, 0, 0, -1)


# ---------------------------------------------------------------------------
# aggregate_wer
# ---------------------------------------------------------------------------

class TestAggregateWer:
    def _make_counts(self, items):
        """Helper: list of (S, D, I, ref) tuples → EditCounts list."""
        return [EditCounts(s, d, i, r) for (s, d, i, r) in items]

    def test_no_records_returns_no_data(self):
        result = aggregate_wer([])
        assert result.status == WerStatus.NO_DATA
        assert result.wer_pct is None
        assert result.recording_count == 0

    def test_aggregate_uses_summed_counts_not_average(self):
        """
        Two recordings:
          rec1: (1,0,0,4) → WER = 25%
          rec2: (0,0,0,4) → WER = 0%
        Average of percentages = 12.5%
        Correct summed formula = 1/8*100 = 12.5% (coincidence here, different counts)

        Use asymmetric case to distinguish:
          rec1: (3,0,0,4) → WER = 75%
          rec2: (0,0,0,6) → WER = 0%
        Average = 37.5%
        Correct = 3/10*100 = 30%
        """
        counts = self._make_counts([(3, 0, 0, 4), (0, 0, 0, 6)])
        # Need 5 recordings for threshold; use min_recordings=2 for this test
        result = aggregate_wer(counts, min_recordings=2, min_reference_words=5)
        assert result.status in (WerStatus.OK, WerStatus.HIGH_WER)
        assert result.wer_pct == pytest.approx(30.0)

    def test_insufficient_recordings(self):
        counts = self._make_counts([(0, 0, 0, 10)])  # only 1 recording
        result = aggregate_wer(counts, min_recordings=5, min_reference_words=5)
        assert result.status == WerStatus.INSUFFICIENT
        assert result.wer_pct is None

    def test_insufficient_words(self):
        counts = self._make_counts([(0, 0, 0, 3)] * 5)  # 5 recordings, 15 words
        result = aggregate_wer(counts, min_recordings=5, min_reference_words=20)
        assert result.status == WerStatus.INSUFFICIENT
        assert result.wer_pct is None

    def test_zero_ref_words_excluded(self):
        """Records with reference_word_count=0 are excluded from WER calc
        but do not count toward the valid-recording threshold."""
        counts = [
            EditCounts(1, 0, 0, 4),
            EditCounts(0, 0, 0, 0),   # zero ref words → excluded from WER pool
            EditCounts(0, 0, 0, 4),
            EditCounts(0, 0, 0, 4),
            EditCounts(0, 0, 0, 4),
        ]
        # 5 total recordings, but only 4 have non-zero ref words.
        # With min_recordings=4, the 4 valid ones meet the threshold.
        # Subs=1, refs=4+4+4+4=16 → WER = 1/16 * 100 = 6.25%
        result = aggregate_wer(counts, min_recordings=4, min_reference_words=10)
        assert result.status == WerStatus.OK
        assert result.wer_pct == pytest.approx(6.25)
        # Also confirm the zero-ref record is fully excluded from word counts
        assert result.reference_word_count == 16

    def test_zero_ref_words_only_returns_cannot_calculate(self):
        counts = [EditCounts(0, 0, 0, 0)] * 5
        result = aggregate_wer(counts, min_recordings=1, min_reference_words=1)
        assert result.status == WerStatus.CANNOT_CALCULATE
        assert result.wer_pct is None

    def test_high_wer_threshold(self):
        # WER = 4/10 * 100 = 40% → HIGH_WER
        counts = self._make_counts([(2, 1, 1, 10)] * 5)
        result = aggregate_wer(
            counts, min_recordings=5, min_reference_words=20, high_wer_threshold=30.0
        )
        assert result.status == WerStatus.HIGH_WER
        assert result.wer_pct == pytest.approx(40.0)

    def test_ok_below_threshold(self):
        # WER = 1/20 * 100 = 5%
        counts = self._make_counts([(1, 0, 0, 20)] * 5)
        result = aggregate_wer(
            counts, min_recordings=5, min_reference_words=20, high_wer_threshold=30.0
        )
        assert result.status == WerStatus.OK
        assert result.wer_pct == pytest.approx(5.0 * 5 / 5)  # 5%

    def test_absent_records_not_zero_wer(self):
        """No data must never produce a 0% WER score."""
        result = aggregate_wer([])
        assert result.status == WerStatus.NO_DATA
        assert result.wer_pct is None   # Never 0.0

    def test_recording_count_and_word_count_populated(self):
        counts = self._make_counts([(0, 0, 0, 5)] * 6)
        result = aggregate_wer(counts, min_recordings=5, min_reference_words=20)
        assert result.recording_count == 6
        assert result.reference_word_count == 30
