import { useEffect, useState } from "react";
import { api } from "../../api/client";
import type { VoiceSubmission } from "../../types";

interface SubmissionDetailViewProps {
  submissionId: string;
  onBack: () => void;
  isAdmin?: boolean;
}

export function SubmissionDetailView({ submissionId, onBack, isAdmin = false }: SubmissionDetailViewProps) {
  const [submission, setSubmission] = useState<VoiceSubmission | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Withdrawal state
  const [withdrawing, setWithdrawing] = useState(false);
  const [withdrawMessage, setWithdrawMessage] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    api.submissionDetails(submissionId)
      .then((data) => setSubmission(data))
      .catch((err) => setError(err.message || "Failed to load submission details."))
      .finally(() => setLoading(false));
  }, [submissionId]);

  const handleWithdraw = async () => {
    if (!submission) return;
    if (!confirm("Are you certain you want to permanently delete this audio recording? This action cannot be undone.")) {
      return;
    }

    setWithdrawing(true);
    setWithdrawMessage(null);
    try {
      const res = await api.withdrawSubmission(
        submission.id,
        submission.deletion_token,
        "User initiated erasure via submission detail view"
      );
      setWithdrawMessage(res.message);
      setSubmission((prev) => (prev ? { ...prev, status: "WITHDRAWN" } : null));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Withdrawal failed.");
    } finally {
      setWithdrawing(false);
    }
  };

  if (loading) {
    return (
      <div style={{ maxWidth: "860px", margin: "2rem auto", textAlign: "center", color: "#64748B" }}>
        Loading submission details…
      </div>
    );
  }

  if (error || !submission) {
    return (
      <div style={{ maxWidth: "860px", margin: "0 auto" }}>
        <button
          type="button"
          onClick={onBack}
          style={{
            background: "#FFFFFF",
            border: "1px solid #CBD5E1",
            color: "#475569",
            padding: "0.4rem 0.85rem",
            borderRadius: "6px",
            fontSize: "0.82rem",
            fontWeight: 600,
            cursor: "pointer",
            marginBottom: "1rem",
          }}
        >
          ← Return
        </button>
        <div
          role="alert"
          style={{
            background: "#FEF2F2",
            border: "1px solid #FECACA",
            color: "#DC2626",
            padding: "1.25rem",
            borderRadius: "10px",
          }}
        >
          ⚠️ {error || "Submission not found."}
        </div>
      </div>
    );
  }

  const audioStreamUrl = api.submissionAudioUrl(submission.id, submission.deletion_token);
  const isApproved = submission.status === "APPROVED";
  const isWithdrawn = submission.status === "WITHDRAWN";
  const isPending = submission.status === "PENDING_REVIEW" || submission.status === "RECEIVED";

  return (
    <div style={{ maxWidth: "860px", margin: "0 auto" }}>
      {/* Navigation & Header */}
      <div style={{ marginBottom: "1.25rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <button
          type="button"
          onClick={onBack}
          style={{
            background: "#FFFFFF",
            border: "1px solid #CBD5E1",
            color: "#475569",
            padding: "0.4rem 0.85rem",
            borderRadius: "6px",
            fontSize: "0.82rem",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          ← Back to List
        </button>

        <span
          className={`bl-badge ${
            isApproved
              ? "bl-badge-success"
              : isWithdrawn
              ? "bl-badge-danger"
              : isPending
              ? "bl-badge-warning"
              : "bl-badge-primary"
          }`}
          style={{ fontSize: "0.82rem", padding: "0.3rem 0.75rem" }}
        >
          {submission.status.replace("_", " ")}
        </span>
      </div>

      {/* Main Details Card */}
      <div className="bl-card" style={{ padding: "2rem", marginBottom: "1.5rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "1rem", marginBottom: "1.5rem" }}>
          <div>
            <h1 style={{ fontSize: "1.35rem", fontWeight: 800, color: "#1F2937", margin: "0 0 0.25rem" }}>
              Submission {submission.id}
            </h1>
            <p style={{ fontSize: "0.82rem", color: "#64748B", margin: 0 }}>
              Submitted on {new Date(submission.created_at).toLocaleString()} · Mode: {submission.contribution_mode}
            </p>
          </div>

          <div style={{ textAlign: "right" }}>
            <span style={{ fontSize: "0.78rem", fontWeight: 700, color: "#1F2937" }}>
              {submission.language}
            </span>
            {submission.dialect && (
              <div style={{ fontSize: "0.75rem", color: "#64748B" }}>
                Dialect: {submission.dialect}
              </div>
            )}
          </div>
        </div>

        {/* Audio Player */}
        <div
          style={{
            background: "#F8FAFC",
            border: "1px solid #E2E8F0",
            borderRadius: "10px",
            padding: "1.25rem",
            marginBottom: "1.5rem",
          }}
        >
          <div style={{ fontSize: "0.82rem", fontWeight: 700, color: "#334155", marginBottom: "0.6rem" }}>
            🔊 Secure Audio Playback
          </div>
          {isWithdrawn ? (
            <div style={{ color: "#991B1B", fontSize: "0.85rem", fontStyle: "italic" }}>
              Audio recording has been permanently deleted as requested by the contributor under right-to-erasure policy.
            </div>
          ) : (
            <div>
              <audio controls src={audioStreamUrl} style={{ width: "100%", outline: "none" }} />
              <div style={{ fontSize: "0.75rem", color: "#64748B", marginTop: "0.35rem" }}>
                Format: <code>{submission.audio_format}</code> · Duration: {submission.audio_duration_sec?.toFixed(1) || "—"}s · Size: {Math.round(submission.audio_size_bytes / 1024)} KB
              </div>
            </div>
          )}
        </div>

        {/* Transcripts Comparison */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: submission.reference_text ? "1fr 1fr" : "1fr",
            gap: "1rem",
            marginBottom: "1.5rem",
          }}
        >
          {submission.reference_text && (
            <div style={{ background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: "10px", padding: "1.25rem" }}>
              <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "#64748B", textTransform: "uppercase", marginBottom: "0.35rem" }}>
                Target Reference Sentence
              </div>
              <p style={{ fontSize: "1.05rem", fontWeight: 600, color: "#1F2937", lineHeight: 1.6, margin: 0 }}>
                {submission.reference_text}
              </p>
            </div>
          )}

          <div style={{ background: "#EFF6FF", border: "1px solid #BFDBFE", borderRadius: "10px", padding: "1.25rem" }}>
            <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "#2563EB", textTransform: "uppercase", marginBottom: "0.35rem" }}>
              ASR Recognition Hypothesis
            </div>
            <p style={{ fontSize: "1.05rem", fontWeight: 600, color: "#1E40AF", lineHeight: 1.6, margin: 0 }}>
              {submission.hypothesis_text || "—"}
            </p>
            <div style={{ fontSize: "0.72rem", color: "#3B82F6", marginTop: "0.5rem" }}>
              Model: {submission.model_name || "Regional Conformer-CTC"} {submission.model_version || "v2.0"}
            </div>
          </div>
        </div>

        {/* WER Metrics Cards */}
        {submission.reference_word_count > 0 && (
          <div style={{ marginBottom: "1.5rem" }}>
            <div style={{ fontSize: "0.82rem", fontWeight: 700, color: "#374151", marginBottom: "0.6rem" }}>
              📊 Alignment &amp; Word Error Rate Breakdown
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: "0.75rem" }}>
              <div style={{ background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: "8px", padding: "0.75rem", textAlign: "center" }}>
                <div style={{ fontSize: "0.72rem", color: "#64748B", fontWeight: 600 }}>WER %</div>
                <div style={{ fontSize: "1.35rem", fontWeight: 800, color: "#1F2937" }}>
                  {submission.wer_pct !== null && submission.wer_pct !== undefined ? `${submission.wer_pct.toFixed(1)}%` : "—"}
                </div>
              </div>

              <div style={{ background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: "8px", padding: "0.75rem", textAlign: "center" }}>
                <div style={{ fontSize: "0.72rem", color: "#64748B", fontWeight: 600 }}>Substitutions</div>
                <div style={{ fontSize: "1.35rem", fontWeight: 800, color: "#D97706" }}>
                  {submission.substitutions ?? 0}
                </div>
              </div>

              <div style={{ background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: "8px", padding: "0.75rem", textAlign: "center" }}>
                <div style={{ fontSize: "0.72rem", color: "#64748B", fontWeight: 600 }}>Deletions</div>
                <div style={{ fontSize: "1.35rem", fontWeight: 800, color: "#DC2626" }}>
                  {submission.deletions ?? 0}
                </div>
              </div>

              <div style={{ background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: "8px", padding: "0.75rem", textAlign: "center" }}>
                <div style={{ fontSize: "0.72rem", color: "#64748B", fontWeight: 600 }}>Insertions</div>
                <div style={{ fontSize: "1.35rem", fontWeight: 800, color: "#6366F1" }}>
                  {submission.insertions ?? 0}
                </div>
              </div>

              <div style={{ background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: "8px", padding: "0.75rem", textAlign: "center" }}>
                <div style={{ fontSize: "0.72rem", color: "#64748B", fontWeight: 600 }}>Ref Words</div>
                <div style={{ fontSize: "1.35rem", fontWeight: 800, color: "#1F2937" }}>
                  {submission.reference_word_count ?? 0}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Demographic Metadata Slice */}
        <div style={{ background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: "10px", padding: "1rem", marginBottom: "1.5rem" }}>
          <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "#64748B", textTransform: "uppercase", marginBottom: "0.4rem" }}>
            Demographic Context
          </div>
          <div style={{ display: "flex", gap: "1.5rem", fontSize: "0.85rem", color: "#1F2937" }}>
            <div>District: <strong>{submission.district || "Not specified"}</strong></div>
            <div>Gender: <strong>{submission.gender || "Not specified"}</strong></div>
            <div>Age Group: <strong>{submission.age_group || "Not specified"}</strong></div>
          </div>
        </div>

        {/* Review & Audit History */}
        {submission.history && submission.history.length > 0 && (
          <div style={{ marginBottom: "1.5rem" }}>
            <div style={{ fontSize: "0.82rem", fontWeight: 700, color: "#374151", marginBottom: "0.6rem" }}>
              📜 Review &amp; Audit Log
            </div>
            <div style={{ border: "1px solid #E2E8F0", borderRadius: "8px", overflow: "hidden" }}>
              <table style={{ margin: 0, border: "none" }}>
                <thead>
                  <tr>
                    <th>Timestamp</th>
                    <th>Actor</th>
                    <th>Action</th>
                    <th>Transition</th>
                    <th>Reason / Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {submission.history.map((h) => (
                    <tr key={h.id}>
                      <td style={{ fontSize: "0.75rem", color: "#64748B", whiteSpace: "nowrap" }}>
                        {new Date(h.timestamp).toLocaleString()}
                      </td>
                      <td style={{ fontWeight: 600, color: "#1F2937" }}>
                        {h.reviewer_name} ({h.reviewer_role})
                      </td>
                      <td>
                        <span className="bl-badge bl-badge-neutral" style={{ fontSize: "0.72rem" }}>
                          {h.action}
                        </span>
                      </td>
                      <td style={{ fontSize: "0.78rem", color: "#64748B" }}>
                        {h.prior_status} → <strong>{h.new_status}</strong>
                      </td>
                      <td style={{ fontSize: "0.78rem", color: "#475569" }}>
                        {h.reason || h.notes || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Right to Erasure / Contributor Safeguard */}
        {!isAdmin && !isWithdrawn && (
          <div
            style={{
              background: "#FFFBEB",
              border: "1px solid #FDE68A",
              borderRadius: "10px",
              padding: "1.25rem",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "1rem",
            }}
          >
            <div>
              <div style={{ fontSize: "0.85rem", fontWeight: 700, color: "#92400E", marginBottom: "0.2rem" }}>
                Contributor Right to Erasure
              </div>
              <p style={{ fontSize: "0.78rem", color: "#78350F", margin: 0 }}>
                You hold full ownership of your voice. Withdrawing permanently purges the audio file from disk.
              </p>
            </div>

            <button
              type="button"
              onClick={handleWithdraw}
              disabled={withdrawing}
              style={{
                background: "#DC2626",
                color: "#FFFFFF",
                border: "none",
                borderRadius: "6px",
                padding: "0.5rem 1rem",
                fontSize: "0.82rem",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              {withdrawing ? "Deleting Audio…" : "🗑️ Withdraw & Purge Recording"}
            </button>
          </div>
        )}

        {withdrawMessage && (
          <div style={{ marginTop: "1rem", padding: "0.75rem", background: "#ECFDF5", border: "1px solid #A7F3D0", borderRadius: "6px", color: "#065F46", fontSize: "0.82rem" }}>
            ✓ {withdrawMessage}
          </div>
        )}
      </div>
    </div>
  );
}
