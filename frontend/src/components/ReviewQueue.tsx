import { useState, useEffect } from "react";
import { api } from "../api/client";
import type { VoiceSubmission } from "../types";

const REJECTION_REASONS = [
  { value: "unintelligible", label: "Speech is unintelligible or inaudible" },
  { value: "background_noise", label: "Excessive background noise or interference" },
  { value: "wrong_language", label: "Speech is not in the declared language/dialect" },
  { value: "policy_violation", label: "Inappropriate language or policy violation" },
  { value: "duplicate", label: "Duplicate or identical recording already present" },
  { value: "silent_recording", label: "Silent recording with no speech content" },
  { value: "other", label: "Other reason (specify in notes)" },
];

export function ReviewQueue({ onReviewAction }: { onReviewAction?: () => void }) {
  const [submissions, setSubmissions] = useState<VoiceSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState("PENDING_REVIEW");
  const [langFilter, setLangFilter] = useState("");

  // Selected Submission for Review
  const [selectedSub, setSelectedSub] = useState<VoiceSubmission | null>(null);

  // Reviewer credentials & action form
  const [reviewerName, setReviewerName] = useState("Linguist-Reviewer-01");
  const [reviewerRole, setReviewerRole] = useState("reviewer");
  const [correctionText, setCorrectionText] = useState("");
  const [rejectionReason, setRejectionReason] = useState("unintelligible");
  const [notes, setNotes] = useState("");
  const [submittingAction, setSubmittingAction] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  // Audit history modal
  const [showHistory, setShowHistory] = useState(false);

  const handleSelectSubmission = (sub: VoiceSubmission) => {
    setSelectedSub(sub);
    setCorrectionText(sub.reference_text || sub.hypothesis_text || "");
    setActionMessage(null);
    // Fetch full details with audit history
    api.submissionDetails(sub.id)
      .then((full) => setSelectedSub(full))
      .catch(() => {});
  };

  const fetchSubmissions = () => {
    setLoading(true);
    setError(null);
    api.submissions({
      status: statusFilter || undefined,
      language: langFilter || undefined,
      limit: 50,
    })
      .then((res) => {
        setSubmissions(res.submissions);
        if (res.submissions.length > 0) {
          // If selected sub is still in list, refresh it
          const stillSelected = res.submissions.find((s) => s.id === selectedSub?.id);
          if (stillSelected) {
            handleSelectSubmission(stillSelected);
          } else {
            handleSelectSubmission(res.submissions[0]);
          }
        } else {
          setSelectedSub(null);
        }
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Failed to load submissions.");
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchSubmissions();
  }, [statusFilter, langFilter]);

  const handleAction = async (action: "APPROVE" | "REJECT" | "CORRECT" | "REQUEST_REVIEW" | "EXCLUDE") => {
    if (!selectedSub) return;
    if (!reviewerName.trim()) {
      setError("Please enter your reviewer name/ID.");
      return;
    }
    if (action === "REJECT" && !rejectionReason) {
      setError("Please select a rejection reason.");
      return;
    }

    setSubmittingAction(true);
    setActionMessage(null);
    setError(null);

    try {
      const res = await api.reviewSubmission(
        {
          submission_id: selectedSub.id,
          reviewer_name: reviewerName.trim(),
          reviewer_role: reviewerRole,
          action,
          corrected_transcript: action === "APPROVE" || action === "CORRECT" ? correctionText.trim() : undefined,
          rejection_reason: action === "REJECT" ? rejectionReason : undefined,
          notes: notes.trim() || undefined,
        },
        reviewerRole
      );

      setActionMessage(`Action '${action}' recorded. Status updated to ${res.status}.`);
      setNotes("");
      fetchSubmissions();
      if (onReviewAction) onReviewAction();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Review action failed.");
    } finally {
      setSubmittingAction(false);
    }
  };

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: "1.5rem" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem", flexWrap: "wrap", gap: "1rem" }}>
        <div>
          <h2 style={{ margin: "0 0 0.35rem", fontSize: "1.5rem", fontWeight: 700, color: "#1e1b4b" }}>
            🧑‍🔬 Human-in-the-Loop Review Queue
          </h2>
          <p style={{ margin: 0, color: "#64748b", fontSize: "0.85rem" }}>
            Verify community recordings, inspect AI hypotheses, correct transcripts, and approve records for published benchmarks.
          </p>
        </div>

        {/* Reviewer Credentials */}
        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", background: "#f8fafc", padding: "0.5rem 0.75rem", borderRadius: "0.5rem", border: "1px solid #e2e8f0" }}>
          <div>
            <label style={{ fontSize: "0.68rem", color: "#64748b", display: "block" }}>Reviewer Identity</label>
            <input
              type="text"
              value={reviewerName}
              onChange={(e) => setReviewerName(e.target.value)}
              style={{ fontSize: "0.8rem", padding: "0.2rem 0.4rem", borderRadius: "0.3rem", border: "1px solid #cbd5e1" }}
            />
          </div>
          <div>
            <label style={{ fontSize: "0.68rem", color: "#64748b", display: "block" }}>Role</label>
            <select
              value={reviewerRole}
              onChange={(e) => setReviewerRole(e.target.value)}
              style={{ fontSize: "0.8rem", padding: "0.2rem 0.4rem", borderRadius: "0.3rem", border: "1px solid #cbd5e1" }}
            >
              <option value="reviewer">Reviewer</option>
              <option value="admin">Admin</option>
            </select>
          </div>
        </div>
      </div>

      {/* Queue Filter Bar */}
      <div
        style={{
          display: "flex",
          gap: "1rem",
          alignItems: "center",
          background: "#fff",
          border: "1px solid #e2e8f0",
          borderRadius: "0.75rem",
          padding: "0.85rem 1.25rem",
          marginBottom: "1.5rem",
        }}
      >
        <div>
          <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "#475569", marginRight: "0.5rem" }}>
            Status:
          </label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{ padding: "0.4rem 0.6rem", borderRadius: "0.4rem", border: "1px solid #cbd5e1", fontSize: "0.82rem" }}
          >
            <option value="">All Statuses</option>
            <option value="PENDING_REVIEW">Pending Review</option>
            <option value="NEEDS_CORRECTION">Needs Correction</option>
            <option value="APPROVED">Approved</option>
            <option value="REJECTED">Rejected</option>
            <option value="WITHDRAWN">Withdrawn</option>
          </select>
        </div>

        <div>
          <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "#475569", marginRight: "0.5rem" }}>
            Language:
          </label>
          <select
            value={langFilter}
            onChange={(e) => setLangFilter(e.target.value)}
            style={{ padding: "0.4rem 0.6rem", borderRadius: "0.4rem", border: "1px solid #cbd5e1", fontSize: "0.82rem" }}
          >
            <option value="">All Languages</option>
            <option value="Hindi">Hindi</option>
            <option value="Marathi">Marathi</option>
            <option value="Bhojpuri">Bhojpuri</option>
            <option value="Chhattisgarhi">Chhattisgarhi</option>
            <option value="Maithili">Maithili</option>
          </select>
        </div>

        <button
          type="button"
          onClick={fetchSubmissions}
          style={{
            marginLeft: "auto",
            background: "#f1f5f9",
            color: "#475569",
            border: "1px solid #cbd5e1",
            padding: "0.4rem 0.85rem",
            borderRadius: "0.4rem",
            fontSize: "0.82rem",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          🔄 Refresh Queue
        </button>
      </div>

      {/* Main Grid: Submission List vs Detail Pane */}
      <div style={{ display: "grid", gridTemplateColumns: "350px 1fr", gap: "1.5rem" }}>
        {/* Left: Queue List */}
        <div
          style={{
            background: "#fff",
            border: "1px solid #e2e8f0",
            borderRadius: "0.75rem",
            padding: "0.75rem",
            maxHeight: 700,
            overflowY: "auto",
          }}
        >
          <div style={{ fontSize: "0.8rem", fontWeight: 700, color: "#64748b", padding: "0.5rem 0.5rem 0.75rem" }}>
            Submissions ({submissions.length})
          </div>

          {loading ? (
            <div style={{ padding: "2rem", textAlign: "center", color: "#94a3b8", fontSize: "0.85rem" }}>
              Loading queue...
            </div>
          ) : submissions.length === 0 ? (
            <div style={{ padding: "2rem", textAlign: "center", color: "#94a3b8", fontSize: "0.85rem" }}>
              No submissions match the filter.
            </div>
          ) : (
            submissions.map((sub) => {
              const isSelected = selectedSub?.id === sub.id;
              const hasFlags = sub.quality_flags_json && sub.quality_flags_json !== "[]";
              return (
                <div
                  key={sub.id}
                  onClick={() => handleSelectSubmission(sub)}
                  style={{
                    padding: "0.75rem",
                    borderRadius: "0.5rem",
                    marginBottom: "0.5rem",
                    cursor: "pointer",
                    border: isSelected ? "2px solid #6366f1" : "1px solid #f1f5f9",
                    background: isSelected ? "#eef2ff" : "#fff",
                    transition: "all 0.15s ease",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.25rem" }}>
                    <span style={{ fontSize: "0.8rem", fontWeight: 700, color: isSelected ? "#4338ca" : "#0f172a" }}>
                      {sub.language} {sub.dialect ? `(${sub.dialect})` : ""}
                    </span>
                    <span
                      style={{
                        fontSize: "0.65rem",
                        fontWeight: 700,
                        padding: "0.15rem 0.4rem",
                        borderRadius: "0.25rem",
                        background:
                          sub.status === "APPROVED"
                            ? "#dcfce7"
                            : sub.status === "REJECTED"
                            ? "#fee2e2"
                            : sub.status === "WITHDRAWN"
                            ? "#f1f5f9"
                            : "#fef3c7",
                        color:
                          sub.status === "APPROVED"
                            ? "#15803d"
                            : sub.status === "REJECTED"
                            ? "#b91c1c"
                            : sub.status === "WITHDRAWN"
                            ? "#64748b"
                            : "#b45309",
                      }}
                    >
                      {sub.status}
                    </span>
                  </div>

                  <p
                    style={{
                      margin: "0 0 0.35rem",
                      fontSize: "0.75rem",
                      color: "#475569",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {sub.reference_text || sub.hypothesis_text || "No transcript"}
                  </p>

                  <div style={{ display: "flex", gap: "0.5rem", fontSize: "0.68rem", color: "#94a3b8" }}>
                    <span>{sub.audio_duration_sec}s</span>
                    <span>·</span>
                    <span>{sub.district || "Any District"}</span>
                    {sub.duplicate_of_id && (
                      <span style={{ color: "#d97706", fontWeight: 700 }}>⚠️ Duplicate</span>
                    )}
                    {hasFlags && (
                      <span style={{ color: "#dc2626", fontWeight: 700 }}>⚠️ Quality</span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Right: Detailed Review & Comparison Workspace */}
        {selectedSub ? (
          <div
            style={{
              background: "#fff",
              border: "1px solid #e2e8f0",
              borderRadius: "0.75rem",
              padding: "1.5rem",
            }}
          >
            {/* Top metadata strip */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1.25rem", flexWrap: "wrap", gap: "0.5rem" }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <h3 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 700, color: "#1e1b4b" }}>
                    Submission: <code>{selectedSub.id}</code>
                  </h3>
                  <span
                    style={{
                      background: "#e0e7ff",
                      color: "#4338ca",
                      padding: "0.2rem 0.5rem",
                      borderRadius: "0.3rem",
                      fontSize: "0.72rem",
                      fontWeight: 600,
                    }}
                  >
                    Mode: {selectedSub.contribution_mode.toUpperCase()}
                  </span>
                </div>
                <div style={{ fontSize: "0.78rem", color: "#64748b", marginTop: "0.25rem" }}>
                  Submitted: {new Date(selectedSub.created_at).toLocaleString()} · Cohort: {selectedSub.district || "Unspecified"} / {selectedSub.gender || "Unspecified"} / {selectedSub.age_group || "Unspecified"}
                </div>
              </div>

              <div style={{ display: "flex", gap: "0.5rem" }}>
                <button
                  type="button"
                  onClick={() => setShowHistory(true)}
                  style={{
                    background: "#f8fafc",
                    border: "1px solid #cbd5e1",
                    color: "#475569",
                    padding: "0.35rem 0.75rem",
                    borderRadius: "0.4rem",
                    fontSize: "0.75rem",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  📜 Audit Trail ({selectedSub.history?.length ?? 1})
                </button>
              </div>
            </div>

            {/* Quality & Duplicate Warnings */}
            {(selectedSub.duplicate_of_id || (selectedSub.quality_flags_json && selectedSub.quality_flags_json !== "[]")) && (
              <div
                style={{
                  background: "#fffbeb",
                  border: "1px solid #fde68a",
                  borderRadius: "0.5rem",
                  padding: "0.75rem 1rem",
                  marginBottom: "1.25rem",
                  fontSize: "0.8rem",
                  color: "#92400e",
                }}
              >
                {selectedSub.duplicate_of_id && (
                  <div>
                    <strong>⚠️ Duplicate Audio Detected:</strong> Identical acoustic hash to submission{" "}
                    <code>{selectedSub.duplicate_of_id}</code>. Review carefully before approval.
                  </div>
                )}
                {selectedSub.quality_flags_json && selectedSub.quality_flags_json !== "[]" && (
                  <div style={{ marginTop: "0.25rem" }}>
                    <strong>⚠️ Quality Diagnostic Flags:</strong> {selectedSub.quality_flags_json}
                  </div>
                )}
              </div>
            )}

            {/* Audio Player Widget */}
            <div
              style={{
                background: "#f1f5f9",
                borderRadius: "0.5rem",
                padding: "0.85rem 1rem",
                marginBottom: "1.25rem",
                display: "flex",
                alignItems: "center",
                gap: "1rem",
              }}
            >
              <div style={{ fontSize: "1.25rem" }}>🎧</div>
              <div style={{ flex: 1 }}>
                <audio
                  controls
                  src={api.submissionAudioUrl(selectedSub.id)}
                  style={{ width: "100%", height: 36 }}
                />
              </div>
              <div style={{ fontSize: "0.75rem", color: "#64748b", whiteSpace: "nowrap" }}>
                Duration: {selectedSub.audio_duration_sec}s
              </div>
            </div>

            {/* Side-by-Side Comparison Workspace */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1.25rem" }}>
              {/* Reference */}
              <div
                style={{
                  background: "#f8fafc",
                  border: "1px solid #e2e8f0",
                  borderRadius: "0.5rem",
                  padding: "0.85rem 1rem",
                }}
              >
                <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase", marginBottom: "0.4rem" }}>
                  Reference Transcript
                </div>
                <div style={{ fontSize: "0.95rem", color: "#0f172a", minHeight: 48, lineHeight: 1.5 }}>
                  {selectedSub.reference_text || (
                    <span style={{ color: "#94a3b8", fontStyle: "italic" }}>
                      Natural speech sample (No reference prompt)
                    </span>
                  )}
                </div>
              </div>

              {/* ASR Hypothesis */}
              <div
                style={{
                  background: "#f8fafc",
                  border: "1px solid #e2e8f0",
                  borderRadius: "0.5rem",
                  padding: "0.85rem 1rem",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.4rem" }}>
                  <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>
                    ASR Hypothesis ({selectedSub.model_name || "Mock-ASR"})
                  </span>
                  {selectedSub.wer_pct !== null && (
                    <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "#e11d48" }}>
                      WER: {selectedSub.wer_pct.toFixed(1)}%
                    </span>
                  )}
                </div>
                <div style={{ fontSize: "0.95rem", color: "#312e81", minHeight: 48, lineHeight: 1.5, fontWeight: 500 }}>
                  {selectedSub.hypothesis_text || "No ASR hypothesis generated."}
                </div>
                <div style={{ display: "flex", gap: "0.75rem", fontSize: "0.72rem", color: "#64748b", marginTop: "0.4rem" }}>
                  <span>S: {selectedSub.substitutions}</span>
                  <span>D: {selectedSub.deletions}</span>
                  <span>I: {selectedSub.insertions}</span>
                  <span>Ref Words: {selectedSub.reference_word_count}</span>
                </div>
              </div>
            </div>

            {/* Human Correction Input */}
            <div style={{ marginBottom: "1.25rem" }}>
              <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 700, color: "#334155", marginBottom: "0.4rem" }}>
                Approved / Corrected Transcript (Human Ground Truth)
              </label>
              <textarea
                value={correctionText}
                onChange={(e) => setCorrectionText(e.target.value)}
                rows={3}
                style={{
                  width: "100%",
                  padding: "0.6rem 0.75rem",
                  borderRadius: "0.5rem",
                  border: "1px solid #cbd5e1",
                  fontSize: "0.95rem",
                  fontFamily: "inherit",
                  lineHeight: 1.5,
                }}
                placeholder="Listen to audio and type the exact spoken words to correct errors..."
              />
            </div>

            {/* Action Bar & Reason */}
            <div
              style={{
                background: "#f8fafc",
                border: "1px solid #e2e8f0",
                borderRadius: "0.5rem",
                padding: "1rem",
                marginBottom: "1rem",
              }}
            >
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "0.75rem" }}>
                <div>
                  <label style={{ fontSize: "0.75rem", color: "#475569", display: "block", marginBottom: "0.2rem" }}>
                    Rejection Reason (if rejecting)
                  </label>
                  <select
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    style={{ width: "100%", padding: "0.4rem 0.5rem", borderRadius: "0.4rem", border: "1px solid #cbd5e1", fontSize: "0.82rem" }}
                  >
                    {REJECTION_REASONS.map((r) => (
                      <option key={r.value} value={r.value}>{r.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: "0.75rem", color: "#475569", display: "block", marginBottom: "0.2rem" }}>
                    Reviewer Notes / Justification
                  </label>
                  <input
                    type="text"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="e.g. Corrected dialectal spelling, verified accent"
                    style={{ width: "100%", padding: "0.4rem 0.5rem", borderRadius: "0.4rem", border: "1px solid #cbd5e1", fontSize: "0.82rem" }}
                  />
                </div>
              </div>

              {actionMessage && (
                <div style={{ color: "#16a34a", fontSize: "0.82rem", fontWeight: 600, marginBottom: "0.75rem" }}>
                  ✅ {actionMessage}
                </div>
              )}

              {error && (
                <div style={{ color: "#dc2626", fontSize: "0.82rem", fontWeight: 600, marginBottom: "0.75rem" }}>
                  ⚠️ {error}
                </div>
              )}

              {/* Review Buttons */}
              <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
                <button
                  type="button"
                  onClick={() => handleAction("APPROVE")}
                  disabled={submittingAction || selectedSub.status === "WITHDRAWN"}
                  style={{
                    background: "#16a34a",
                    color: "#fff",
                    border: "none",
                    padding: "0.55rem 1.25rem",
                    borderRadius: "0.4rem",
                    fontSize: "0.85rem",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  ✅ Approve Submission
                </button>

                <button
                  type="button"
                  onClick={() => handleAction("CORRECT")}
                  disabled={submittingAction || selectedSub.status === "WITHDRAWN"}
                  style={{
                    background: "#4f46e5",
                    color: "#fff",
                    border: "none",
                    padding: "0.55rem 1.15rem",
                    borderRadius: "0.4rem",
                    fontSize: "0.85rem",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  ✏️ Save Correction
                </button>

                <button
                  type="button"
                  onClick={() => handleAction("REQUEST_REVIEW")}
                  disabled={submittingAction || selectedSub.status === "WITHDRAWN"}
                  style={{
                    background: "#f1f5f9",
                    color: "#475569",
                    border: "1px solid #cbd5e1",
                    padding: "0.55rem 1rem",
                    borderRadius: "0.4rem",
                    fontSize: "0.85rem",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  🔄 Request Second Review
                </button>

                <button
                  type="button"
                  onClick={() => handleAction("REJECT")}
                  disabled={submittingAction || selectedSub.status === "WITHDRAWN"}
                  style={{
                    background: "#fee2e2",
                    color: "#dc2626",
                    border: "1px solid #fca5a5",
                    padding: "0.55rem 1.15rem",
                    borderRadius: "0.4rem",
                    fontSize: "0.85rem",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  ❌ Reject
                </button>

                <button
                  type="button"
                  onClick={() => handleAction("EXCLUDE")}
                  disabled={submittingAction || selectedSub.status === "WITHDRAWN"}
                  style={{
                    marginLeft: "auto",
                    background: "#f1f5f9",
                    color: "#64748b",
                    border: "1px solid #cbd5e1",
                    padding: "0.55rem 0.85rem",
                    borderRadius: "0.4rem",
                    fontSize: "0.8rem",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  🚫 Exclude from Benchmarks
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div
            style={{
              background: "#fff",
              border: "1px solid #e2e8f0",
              borderRadius: "0.75rem",
              padding: "3rem",
              textAlign: "center",
              color: "#94a3b8",
            }}
          >
            Select a submission from the queue on the left to review audio and transcripts.
          </div>
        )}
      </div>

      {/* Audit History Modal */}
      {showHistory && selectedSub && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: "1rem",
          }}
        >
          <div
            style={{
              background: "#fff",
              borderRadius: "1rem",
              maxWidth: 650,
              width: "100%",
              maxHeight: "85vh",
              overflowY: "auto",
              padding: "1.75rem",
              boxShadow: "0 20px 25px -5px rgba(0,0,0,0.2)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
              <h3 style={{ margin: 0, fontSize: "1.2rem", fontWeight: 700, color: "#1e1b4b" }}>
                📜 Append-Only Review Audit Log
              </h3>
              <button
                type="button"
                onClick={() => setShowHistory(false)}
                style={{ background: "none", border: "none", fontSize: "1.25rem", cursor: "pointer", color: "#64748b" }}
              >
                ✕
              </button>
            </div>

            <p style={{ margin: "0 0 1rem", fontSize: "0.85rem", color: "#64748b" }}>
              Permanent tamper-evident audit history for submission <code>{selectedSub.id}</code>.
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              {selectedSub.history && selectedSub.history.length > 0 ? (
                selectedSub.history.map((entry) => (
                  <div
                    key={entry.id}
                    style={{
                      background: "#f8fafc",
                      border: "1px solid #e2e8f0",
                      borderRadius: "0.5rem",
                      padding: "0.85rem 1rem",
                      fontSize: "0.82rem",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.3rem" }}>
                      <strong>
                        {entry.action} by {entry.reviewer_name} ({entry.reviewer_role})
                      </strong>
                      <span style={{ color: "#94a3b8" }}>{new Date(entry.timestamp).toLocaleString()}</span>
                    </div>

                    <div style={{ color: "#475569", marginBottom: "0.25rem" }}>
                      Transition: <code>{entry.prior_status}</code> ➔ <code>{entry.new_status}</code>
                    </div>

                    {entry.prior_transcript !== entry.new_transcript && (
                      <div style={{ marginTop: "0.4rem", padding: "0.4rem", background: "#fff", borderRadius: "0.3rem", border: "1px solid #e2e8f0" }}>
                        <div style={{ color: "#dc2626" }}>- Prior: {entry.prior_transcript || "None"}</div>
                        <div style={{ color: "#16a34a" }}>+ New: {entry.new_transcript || "None"}</div>
                      </div>
                    )}

                    {entry.reason && (
                      <div style={{ color: "#64748b", marginTop: "0.25rem" }}>
                        Reason: <em>{entry.reason}</em>
                      </div>
                    )}
                    {entry.notes && (
                      <div style={{ color: "#64748b" }}>
                        Notes: <em>{entry.notes}</em>
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <div style={{ color: "#94a3b8", fontSize: "0.85rem" }}>No history recorded yet.</div>
              )}
            </div>

            <button
              type="button"
              onClick={() => setShowHistory(false)}
              style={{
                marginTop: "1.25rem",
                width: "100%",
                background: "#f1f5f9",
                border: "1px solid #cbd5e1",
                padding: "0.6rem",
                borderRadius: "0.5rem",
                fontSize: "0.85rem",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Close Audit Log
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
