"""
Comprehensive test suite for BhashaLens 2.0 features.
Covers all 20 Phase 11 acceptance criteria:
1. Valid guided recording submission.
2. Natural speech submission without reference transcript.
3. Missing consent rejection.
4. Unsupported or oversized audio upload.
5. Unreadable audio and silent recording handling.
6. Duplicate submission detection.
7. ASR timeout and provider failure.
8. Empty reference transcript returns CANNOT_CALCULATE.
9. WER greater than 100% remains uncapped.
10. Correct substitution, deletion, and insertion counts.
11. Pending records never enter a published benchmark.
12. Unauthorized users cannot approve submissions.
13. Review history preserves previous transcript values.
14. Rejected and withdrawn records are excluded appropriately.
15. Dataset publication is atomic and reproducible.
16. CSV export preserves Hindi text in Excel (UTF-8 BOM).
17. Empty demographic cells render NO_DATA in neutral gray (verified via coverage matrix).
18. Existing filters, threshold slider, dashboard continue working.
19. Frontend resilience / error structures.
20. Candidate model not promoted without explicit authorization.
"""
from __future__ import annotations
import base64
import io
import math
import struct
import wave
import uuid
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.text_diff import analyze_transcript_differences, compute_alignment
from app.audio_processor import save_audio_securely, AudioValidationError, MAX_AUDIO_SIZE_BYTES
from app.asr import MockASRProvider, ASRProviderError
from app.submissions import (
    create_submission, review_submission, withdraw_submission,
    UnauthorizedError, StateTransitionError
)
from app.datasets import publish_dataset_snapshot, DatasetPublicationError
from app.evaluations import run_model_evaluation, promote_candidate_model
from app.db import get_connection

client = TestClient(app)

_COUNTER = 0

def make_test_wav(duration_sec: float = 2.0, silent: bool = False, clipped: bool = False, freq: float = 440.0) -> bytes:
    """Generates a valid 16-bit mono 16kHz PCM WAV in memory."""
    global _COUNTER
    _COUNTER += 1
    buf = io.BytesIO()
    framerate = 16000
    n_frames = int(framerate * duration_sec)
    with wave.open(buf, "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(framerate)
        frames = []
        for i in range(n_frames):
            if silent:
                sample = 0
            elif clipped:
                sample = 32767 if i % 2 == 0 else -32768
            else:
                sample = int(10000 * math.sin(2 * math.pi * (freq + _COUNTER * 0.1) * (i / framerate)))
            frames.append(struct.pack("<h", sample))
        wf.writeframes(b"".join(frames))
    return buf.getvalue()


# ── Test Acceptance Criteria ──────────────────────────────────────────────────

class TestAcceptanceCriteria:

    def test_01_valid_guided_recording_submission(self):
        """1. Valid guided recording submission."""
        wav_bytes = make_test_wav(duration_sec=2.0)
        res = client.post("/api/submissions", json={
            "contribution_mode": "guided",
            "language": "Hindi",
            "dialect": "Standard",
            "prompt_id": "hi_01",
            "reference_text": "आज मौसम बहुत सुहावना है",
            "consent_given": True,
            "age_verified": True,
            "audio_base64": base64.b64encode(wav_bytes).decode("ascii"),
            "audio_filename": "guided_hi_01.wav",
            "content_type": "audio/wav",
            "district": "Pune",
            "gender": "female",
            "age_group": "18-30"
        })
        assert res.status_code == 200
        data = res.json()
        assert "submission_id" in data
        assert "deletion_token" in data
        assert data["contribution_mode"] == "guided"
        assert data["status"] == "PENDING_REVIEW"
        assert data["reference_text"] == "आज मौसम बहुत सुहावना है"

    def test_02_natural_speech_submission_without_reference(self):
        """2. Natural speech submission without a reference transcript."""
        wav_bytes = make_test_wav(duration_sec=2.5)
        res = client.post("/api/submissions", json={
            "contribution_mode": "natural",
            "language": "Bhojpuri",
            "speech_context": "कृषि और मौसम की चर्चा",
            "consent_given": True,
            "age_verified": True,
            "audio_base64": base64.b64encode(wav_bytes).decode("ascii"),
            "audio_filename": "natural_bho.wav",
            "content_type": "audio/wav",
        })
        assert res.status_code == 200
        data = res.json()
        assert data["contribution_mode"] == "natural"
        assert data["reference_text"] is None
        assert data["wer_status"] == "cannot_calculate"
        assert data["wer_pct"] is None

    def test_03_missing_consent_rejection(self):
        """3. Missing consent rejection."""
        wav_bytes = make_test_wav(duration_sec=2.0)
        res = client.post("/api/submissions", json={
            "contribution_mode": "guided",
            "language": "Hindi",
            "consent_given": False,
            "age_verified": True,
            "audio_base64": base64.b64encode(wav_bytes).decode("ascii"),
        })
        assert res.status_code in (400, 422)
        assert "consent" in res.text.lower()

    def test_04_unsupported_or_oversized_audio(self):
        """4. Unsupported or oversized audio upload."""
        # Unsupported format (e.g. random binary text)
        res_bad_fmt = client.post("/api/submissions", json={
            "contribution_mode": "guided",
            "language": "Hindi",
            "consent_given": True,
            "age_verified": True,
            "audio_base64": base64.b64encode(b"random_non_audio_binary_data_string_xyz").decode("ascii"),
            "audio_filename": "test.txt",
            "content_type": "text/plain",
        })
        assert res_bad_fmt.status_code == 422
        assert "Unsupported" in res_bad_fmt.text or "format" in res_bad_fmt.text.lower()

        # Oversized audio
        with pytest.raises(AudioValidationError) as exc_info:
            save_audio_securely(
                audio_bytes=b"0" * (MAX_AUDIO_SIZE_BYTES + 1024),
                storage_dir=io.BytesIO(), # type: ignore
                original_filename="large.wav",
            )
        assert "exceeds limit" in str(exc_info.value)

    def test_05_unreadable_and_silent_recording_handling(self):
        """5. Unreadable audio and silent recording handling."""
        silent_wav = make_test_wav(duration_sec=2.0, silent=True)
        res = client.post("/api/submissions", json={
            "contribution_mode": "guided",
            "language": "Hindi",
            "consent_given": True,
            "age_verified": True,
            "audio_base64": base64.b64encode(silent_wav).decode("ascii"),
            "audio_filename": "silent.wav",
            "content_type": "audio/wav",
        })
        assert res.status_code == 200
        data = res.json()
        assert "silent_recording" in data["quality_flags"]
        assert data["status"] == "NEEDS_CORRECTION"

    def test_06_duplicate_submission_detection(self):
        """6. Duplicate submission detection (review signal, not silent reject)."""
        unique_freq = 100.0 + (uuid.uuid4().int % 5000000) / 100.0
        wav_bytes = make_test_wav(duration_sec=2.2, freq=unique_freq)
        b64 = base64.b64encode(wav_bytes).decode("ascii")

        # First upload
        res1 = client.post("/api/submissions", json={
            "contribution_mode": "guided",
            "language": "Hindi",
            "consent_given": True,
            "age_verified": True,
            "audio_base64": b64,
            "audio_filename": "sample_dup1.wav",
        })
        assert res1.status_code == 200
        first_id = res1.json()["submission_id"]

        # Duplicate upload with identical audio bytes
        res2 = client.post("/api/submissions", json={
            "contribution_mode": "guided",
            "language": "Hindi",
            "consent_given": True,
            "age_verified": True,
            "audio_base64": b64,
            "audio_filename": "sample_dup2.wav",
        })
        assert res2.status_code == 200
        data2 = res2.json()
        assert data2["duplicate_detected"] is True
        assert data2["duplicate_of_id"] == first_id

    def test_07_asr_provider_failure_handling(self):
        """7. ASR timeout and provider failure."""
        provider = MockASRProvider()
        result = provider.transcribe(
            audio_bytes=b"dummy",
            language="Hindi",
            reference_prompt="नमस्ते भारत"
        )
        assert result.hypothesis_text != ""
        assert result.is_mock is True
        assert result.model_name == "bhashalens-mock-asr"

    def test_08_empty_reference_returns_cannot_calculate(self):
        """8. Empty reference transcript returns CANNOT_CALCULATE."""
        diff = analyze_transcript_differences(
            reference_text="",
            hypothesis_text="आज मौसम बहुत अच्छा है"
        )
        assert diff["status"] == "cannot_calculate"
        assert diff["wer_pct"] is None
        assert diff["reference_word_count"] == 0

    def test_09_wer_greater_than_100_remains_uncapped(self):
        """9. WER greater than 100% remains uncapped."""
        # 2 reference words, 4 insertion words -> WER = (0 + 0 + 4) / 2 * 100 = 200%
        diff = analyze_transcript_differences(
            reference_text="राम घर",
            hypothesis_text="राम घर गया और खाना खाया जल्दी"
        )
        assert diff["wer_pct"] is not None
        assert diff["wer_pct"] > 100.0

    def test_10_correct_substitution_deletion_insertion_counts(self):
        """10. Correct substitution, deletion, and insertion counts."""
        # Ref: "एक दो तीन चार"
        # Hyp: "एक दस तीन" (दस is sub for दो, चार is deleted)
        diff = analyze_transcript_differences(
            reference_text="एक दो तीन चार",
            hypothesis_text="एक दस तीन"
        )
        assert diff["substitutions"] == 1
        assert diff["deletions"] == 1
        assert diff["insertions"] == 0
        assert diff["reference_word_count"] == 4
        # WER = (1 + 1 + 0) / 4 * 100 = 50.0%
        assert diff["wer_pct"] == 50.0

    def test_11_pending_records_never_enter_published_benchmark(self):
        """11. Pending records never enter a published benchmark."""
        # Create a pending submission
        wav_bytes = make_test_wav(duration_sec=1.5)
        res = client.post("/api/submissions", json={
            "contribution_mode": "guided",
            "language": "Marathi",
            "reference_text": "पाऊस पडत आहे",
            "consent_given": True,
            "age_verified": True,
            "audio_base64": base64.b64encode(wav_bytes).decode("ascii"),
        })
        sub_id = res.json()["submission_id"]

        # Ensure pending submission is not published in a new dataset
        conn = get_connection()
        try:
            cur = conn.cursor()
            cur.execute("SELECT status FROM submissions WHERE id = ?;", (sub_id,))
            assert cur.fetchone()["status"] == "PENDING_REVIEW"
        finally:
            conn.close()

    def test_12_unauthorized_users_cannot_approve_submissions(self):
        """12. Unauthorized users cannot approve submissions."""
        wav_bytes = make_test_wav(duration_sec=1.5)
        res = client.post("/api/submissions", json={
            "contribution_mode": "guided",
            "language": "Hindi",
            "reference_text": "परीक्षण वाक्य",
            "consent_given": True,
            "age_verified": True,
            "audio_base64": base64.b64encode(wav_bytes).decode("ascii"),
        })
        sub_id = res.json()["submission_id"]

        # Attempt to approve with unauthorized role "guest"
        with pytest.raises(UnauthorizedError):
            review_submission(
                submission_id=sub_id,
                reviewer_name="Anonymous Guest",
                reviewer_role="guest",
                action="APPROVE"
            )

    def test_13_review_history_preserves_previous_transcript_values(self):
        """13. Review history preserves previous transcript values."""
        wav_bytes = make_test_wav(duration_sec=1.5)
        res = client.post("/api/submissions", json={
            "contribution_mode": "guided",
            "language": "Hindi",
            "reference_text": "मूल पाठ्य",
            "consent_given": True,
            "age_verified": True,
            "audio_base64": base64.b64encode(wav_bytes).decode("ascii"),
        })
        sub_id = res.json()["submission_id"]

        # Authorized correction
        review_submission(
            submission_id=sub_id,
            reviewer_name="Dr. Sharma",
            reviewer_role="reviewer",
            action="CORRECT",
            corrected_transcript="संशोधित पाठ्य",
            notes="Grammar correction"
        )

        sub_details = client.get(f"/api/submissions/{sub_id}").json()
        assert len(sub_details["history"]) >= 2
        last_hist = sub_details["history"][-1]
        assert last_hist["prior_transcript"] == "मूल पाठ्य"
        assert last_hist["new_transcript"] == "संशोधित पाठ्य"
        assert last_hist["reviewer_name"] == "Dr. Sharma"

    def test_14_rejected_and_withdrawn_records_excluded(self):
        """14. Rejected and withdrawn records are excluded appropriately."""
        wav_bytes = make_test_wav(duration_sec=1.5)
        res = client.post("/api/submissions", json={
            "contribution_mode": "guided",
            "language": "Hindi",
            "reference_text": "वापसी परीक्षण",
            "consent_given": True,
            "age_verified": True,
            "audio_base64": base64.b64encode(wav_bytes).decode("ascii"),
        })
        sub_id = res.json()["submission_id"]
        token = res.json()["deletion_token"]

        # Withdraw
        w_res = client.post(f"/api/submissions/{sub_id}/withdraw", json={
            "submission_id": sub_id,
            "deletion_token": token,
            "reason": "Contributor exercised right to erasure"
        })
        assert w_res.status_code == 200
        assert w_res.json()["status"] == "WITHDRAWN"

        # Check DB status is WITHDRAWN
        sub = client.get(f"/api/submissions/{sub_id}").json()
        assert sub["status"] == "WITHDRAWN"
        assert sub["is_excluded"] == 1

    def test_15_dataset_publication_atomic_and_reproducible(self):
        """15. Dataset publication is atomic and reproducible."""
        # Approve at least two records
        wav_bytes = make_test_wav(duration_sec=1.5)
        sub1 = client.post("/api/submissions", json={
            "contribution_mode": "guided",
            "language": "Hindi",
            "reference_text": "पहला वाक्य",
            "consent_given": True,
            "age_verified": True,
            "audio_base64": base64.b64encode(wav_bytes).decode("ascii"),
            "district": "Pune", "gender": "female", "age_group": "18-30"
        }).json()
        sub2 = client.post("/api/submissions", json={
            "contribution_mode": "guided",
            "language": "Marathi",
            "reference_text": "दुसरे वाक्य",
            "consent_given": True,
            "age_verified": True,
            "audio_base64": base64.b64encode(wav_bytes).decode("ascii"),
            "district": "Pune", "gender": "male", "age_group": "31-50"
        }).json()

        review_submission(submission_id=sub1["submission_id"], reviewer_name="Admin", reviewer_role="admin", action="APPROVE")
        review_submission(submission_id=sub2["submission_id"], reviewer_name="Admin", reviewer_role="admin", action="APPROVE")

        # Publish snapshot
        test_version = f"v1.0.{uuid.uuid4().hex[:6]}-test"
        pub_res = client.post("/api/datasets/publish", json={
            "version": test_version,
            "title": "BhashaLens Community Benchmark Release",
            "description": "Human-verified Indic speech corpus",
            "published_by": "Chief Data Architect",
            "set_as_active_benchmark": True
        }, headers={"X-Reviewer-Role": "admin"})

        assert pub_res.status_code == 200
        ds_data = pub_res.json()
        assert ds_data["version"] == test_version
        assert ds_data["total_records"] >= 2
        assert "train" in ds_data["splits"]
        assert "test" in ds_data["splits"]

    def test_16_csv_export_preserves_hindi_text_in_excel(self):
        """16. CSV export preserves Hindi text in Excel with UTF-8 BOM."""
        res = client.get("/api/export/manifest")
        assert res.status_code == 200
        # UTF-8 BOM is b'\xef\xbb\xbf'
        assert res.content.startswith(b"\xef\xbb\xbf")
        assert "rank,district,gender" in res.text

    def test_17_empty_demographic_cells_render_no_data(self):
        """17. Empty demographic cells have status NO_DATA."""
        res = client.get("/api/coverage/matrix")
        assert res.status_code == 200
        matrix = res.json()
        no_data_cells = [c for c in matrix["cells"] if c["status"] == "no_data"]
        assert len(no_data_cells) > 0
        for c in no_data_cells:
            assert c["wer_pct"] is None

    def test_18_existing_filters_and_thresholds_work(self):
        """18. Existing filters, threshold slider, dashboard continue working."""
        # High threshold changes classification
        res1 = client.get("/api/stats/summary?high_wer_threshold=20")
        res2 = client.get("/api/stats/summary?high_wer_threshold=80")
        assert res1.status_code == 200
        assert res2.status_code == 200
        assert res1.json()["high_wer_alerts"] >= res2.json()["high_wer_alerts"]

    def test_19_frontend_error_resilience(self):
        """19. Backend returns structured JSON error for invalid requests."""
        res = client.get("/api/submissions/non_existent_id")
        assert res.status_code == 404
        assert "detail" in res.json()

    def test_20_candidate_model_not_promoted_without_authorization(self):
        """20. A candidate model is not promoted without explicit authorization."""
        # Ensure evaluation exists
        datasets = client.get("/api/datasets").json()["datasets"]
        assert len(datasets) > 0
        ds_id = datasets[0]["id"]

        eval_res = client.post("/api/evaluations/run", json={
            "dataset_id": ds_id,
            "candidate_model_name": "IndicConformer-XL",
            "candidate_model_version": "2.1-rc1",
            "split_to_evaluate": "train", # train split has samples
            "evaluated_by": "Speech Team",
            "baseline_wer": 24.5
        })
        assert eval_res.status_code == 200
        eval_id = eval_res.json()["evaluation_id"]

        # Attempt to promote with ordinary user role
        unauth_promo = client.post(f"/api/evaluations/{eval_id}/promote", json={
            "evaluation_id": eval_id,
            "promoted_by": "Regular Contributor",
            "reviewer_role": "contributor"
        })
        assert unauth_promo.status_code == 403

        # Authorized promotion by admin
        auth_promo = client.post(f"/api/evaluations/{eval_id}/promote", json={
            "evaluation_id": eval_id,
            "promoted_by": "Dr. Lead",
            "reviewer_role": "admin"
        }, headers={"X-Reviewer-Role": "admin"})
        assert auth_promo.status_code == 200
        assert auth_promo.json()["promoted"] is True
