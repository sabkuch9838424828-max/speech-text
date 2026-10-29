import { useEffect, useState } from "react";
import { api } from "../../api/client";
import type { VoiceSubmission } from "../../types";

interface AdminSubmissionsViewProps {
  onSelectSubmission: (submissionId: string) => void;
  onNavigateToReview: (submissionId: string) => void;
}

export function AdminSubmissionsView({ onSelectSubmission, onNavigateToReview }: AdminSubmissionsViewProps) {
  const [submissions, setSubmissions] = useState<VoiceSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState("");
  const [languageFilter, setLanguageFilter] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  const fetchSubmissions = () => {
    setLoading(true);
    setError(null);
    api.submissions({
      status: statusFilter || undefined,
      language: languageFilter || undefined,
      limit: 100,
    })
      .then((res) => setSubmissions(res.submissions))
      .catch((err) => setError(err.message || "Failed to load submissions."))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchSubmissions();
  }, [statusFilter, languageFilter]);

  const filtered = submissions.filter((sub) => {
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      const matchHypo = sub.hypothesis_text?.toLowerCase().includes(term);
      const matchRef = sub.reference_text?.toLowerCase().includes(term);
      const matchId = sub.id?.toLowerCase().includes(term);
      const matchDist = sub.district?.toLowerCase().includes(term);
      if (!matchHypo && !matchRef && !matchId && !matchDist) return false;
    }
    return true;
  });

  return (
    <div style={{ maxWidth: "1400px", margin: "0 auto" }}>
      {/* Title */}
      <div style={{ marginBottom: "1.5rem", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem" }}>
        <div>
          <h1 style={{ fontSize: "1.35rem", fontWeight: 800, color: "#1F2937", margin: "0 0 0.25rem" }}>
            System-Wide Speech Submissions
          </h1>
          <p style={{ fontSize: "0.85rem", color: "#64748B", margin: 0 }}>
            Inspect community recordings across all dialect groups and audit verification pipelines.
          </p>
        </div>
      </div>

      {/* Filter Ribbon */}
      <div
        className="bl-card"
        style={{
          padding: "1rem 1.25rem",
          marginBottom: "1.5rem",
          display: "flex",
          gap: "1rem",
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        <div style={{ flex: "1 1 240px" }}>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by ID, hypothesis text, district…"
            style={{ width: "100%", boxSizing: "border-box" }}
          />
        </div>

        <div style={{ minWidth: "160px" }}>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{ width: "100%" }}
          >
            <option value="">All Statuses ({submissions.length})</option>
            <option value="PENDING_REVIEW">PENDING REVIEW</option>
            <option value="APPROVED">APPROVED</option>
            <option value="NEEDS_CORRECTION">NEEDS CORRECTION</option>
            <option value="REJECTED">REJECTED</option>
            <option value="WITHDRAWN">WITHDRAWN</option>
          </select>
        </div>

        <div style={{ minWidth: "160px" }}>
          <select
            value={languageFilter}
            onChange={(e) => setLanguageFilter(e.target.value)}
            style={{ width: "100%" }}
          >
            <option value="">All Languages</option>
            <option value="Hindi">Hindi</option>
            <option value="Marathi">Marathi</option>
            <option value="Bhojpuri">Bhojpuri</option>
            <option value="Chhattisgarhi">Chhattisgarhi</option>
            <option value="Maithili">Maithili</option>
          </select>
        </div>

        {(statusFilter || languageFilter || searchTerm) && (
          <button
            type="button"
            onClick={() => {
              setStatusFilter("");
              setLanguageFilter("");
              setSearchTerm("");
              fetchSubmissions();
            }}
            style={{
              background: "#F1F5F9",
              border: "1px solid #CBD5E1",
              borderRadius: "6px",
              padding: "0.5rem 0.85rem",
              fontSize: "0.82rem",
              color: "#475569",
              cursor: "pointer",
            }}
          >
            Reset
          </button>
        )}
      </div>

      {error && (
        <div
          role="alert"
          style={{
            background: "#FEF2F2",
            border: "1px solid #FECACA",
            color: "#DC2626",
            padding: "0.85rem 1.25rem",
            borderRadius: "10px",
            marginBottom: "1.5rem",
            fontSize: "0.85rem",
          }}
        >
          ⚠️ {error}
        </div>
      )}

      {/* Main Table Card */}
      <div className="bl-card" style={{ padding: 0, overflow: "hidden" }}>
        {loading ? (
          <div style={{ padding: "3rem", textAlign: "center", color: "#64748B" }}>
            Loading submissions…
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: "3rem", textAlign: "center" }}>
            <div style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>🎙️</div>
            <p style={{ fontWeight: 600, color: "#1F2937", margin: 0 }}>No submissions found.</p>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ margin: 0, border: "none" }}>
              <thead>
                <tr>
                  <th>Submission ID</th>
                  <th>Language / Dialect</th>
                  <th>District</th>
                  <th>Mode</th>
                  <th>ASR Hypothesis</th>
                  <th>WER</th>
                  <th>Status</th>
                  <th>Submitted</th>
                  <th style={{ textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((sub) => {
                  const isApproved = sub.status === "APPROVED";
                  const isPending = sub.status === "PENDING_REVIEW" || sub.status === "RECEIVED";
                  const isCorrection = sub.status === "NEEDS_CORRECTION";

                  return (
                    <tr key={sub.id}>
                      <td>
                        <code style={{ fontSize: "0.78rem" }}>{sub.id}</code>
                      </td>
                      <td>
                        <div style={{ fontWeight: 700, color: "#1F2937" }}>{sub.language}</div>
                        {sub.dialect && <div style={{ fontSize: "0.72rem", color: "#64748B" }}>{sub.dialect}</div>}
                      </td>
                      <td>
                        <span style={{ fontSize: "0.82rem", color: "#1F2937" }}>{sub.district || "—"}</span>
                      </td>
                      <td>
                        <span style={{ fontSize: "0.75rem", fontWeight: 600, color: sub.contribution_mode === "guided" ? "#4338CA" : "#0D9488" }}>
                          {sub.contribution_mode}
                        </span>
                      </td>
                      <td style={{ maxWidth: "240px", fontSize: "0.82rem", color: "#334155" }}>
                        <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {sub.hypothesis_text || "—"}
                        </div>
                      </td>
                      <td>
                        <span style={{ fontWeight: 700, color: "#1F2937", fontSize: "0.82rem" }}>
                          {sub.wer_pct !== null && sub.wer_pct !== undefined ? `${sub.wer_pct.toFixed(1)}%` : "—"}
                        </span>
                      </td>
                      <td>
                        <span
                          className={`bl-badge ${
                            isApproved
                              ? "bl-badge-success"
                              : isPending
                              ? "bl-badge-warning"
                              : isCorrection
                              ? "bl-badge-primary"
                              : "bl-badge-neutral"
                          }`}
                        >
                          {sub.status.replace("_", " ")}
                        </span>
                      </td>
                      <td style={{ fontSize: "0.75rem", color: "#64748B", whiteSpace: "nowrap" }}>
                        {new Date(sub.created_at).toLocaleDateString()}
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <div style={{ display: "inline-flex", gap: "0.4rem" }}>
                          <button
                            type="button"
                            onClick={() => onSelectSubmission(sub.id)}
                            style={{
                              background: "#EFF6FF",
                              border: "1px solid #BFDBFE",
                              color: "#2563EB",
                              padding: "0.3rem 0.65rem",
                              borderRadius: "4px",
                              fontSize: "0.75rem",
                              fontWeight: 600,
                              cursor: "pointer",
                            }}
                          >
                            Inspect
                          </button>

                          {isPending && (
                            <button
                              type="button"
                              onClick={() => onNavigateToReview(sub.id)}
                              style={{
                                background: "#F0FDFA",
                                border: "1px solid #99F6E4",
                                color: "#0D9488",
                                padding: "0.3rem 0.65rem",
                                borderRadius: "4px",
                                fontSize: "0.75rem",
                                fontWeight: 700,
                                cursor: "pointer",
                              }}
                            >
                              Review →
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
