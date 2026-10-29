import { useEffect, useState } from "react";
import { api } from "../../api/client";
import type { VoiceSubmission } from "../../types";

interface UserSubmissionsHistoryProps {
  onSelectSubmission: (submissionId: string) => void;
  onNavigate: (route: string) => void;
}

export function UserSubmissionsHistory({ onSelectSubmission, onNavigate }: UserSubmissionsHistoryProps) {
  const [submissions, setSubmissions] = useState<VoiceSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  const fetchSubmissions = () => {
    setLoading(true);
    setError(null);
    api.userSubmissions({ limit: 100 })
      .then((res) => setSubmissions(res.submissions))
      .catch((err) => setError(err.message || "Failed to load submissions."))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchSubmissions();
  }, []);

  const filtered = submissions.filter((sub) => {
    if (statusFilter && sub.status !== statusFilter) return false;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      const matchHypo = sub.hypothesis_text?.toLowerCase().includes(term);
      const matchRef = sub.reference_text?.toLowerCase().includes(term);
      const matchLang = sub.language?.toLowerCase().includes(term);
      const matchDist = sub.district?.toLowerCase().includes(term);
      const matchId = sub.id?.toLowerCase().includes(term);
      if (!matchHypo && !matchRef && !matchLang && !matchDist && !matchId) return false;
    }
    return true;
  });

  return (
    <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
      {/* Page Title & CTA */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "1rem",
          marginBottom: "1.5rem",
        }}
      >
        <div>
          <h1 style={{ fontSize: "1.35rem", fontWeight: 800, color: "#1F2937", margin: "0 0 0.25rem" }}>
            My Voice Submissions
          </h1>
          <p style={{ fontSize: "0.85rem", color: "#64748B", margin: 0 }}>
            Complete audit history of your speech contributions and verification status.
          </p>
        </div>

        <button
          type="button"
          onClick={() => onNavigate("/app/submit")}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "0.4rem",
            background: "#2563EB",
            color: "#FFFFFF",
            border: "none",
            borderRadius: "8px",
            padding: "0.6rem 1.15rem",
            fontSize: "0.85rem",
            fontWeight: 700,
            cursor: "pointer",
            boxShadow: "0 1px 2px rgba(37, 99, 235, 0.2)",
          }}
        >
          <span>🎙️</span>
          <span>Submit New Input</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
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
            placeholder="Search by ID, transcript text, language, district…"
            style={{ width: "100%", boxSizing: "border-box" }}
          />
        </div>

        <div style={{ minWidth: "180px" }}>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{ width: "100%" }}
          >
            <option value="">All Statuses ({submissions.length})</option>
            <option value="APPROVED">Approved / Verified</option>
            <option value="PENDING_REVIEW">Pending Review</option>
            <option value="NEEDS_CORRECTION">Needs Correction</option>
            <option value="REJECTED">Rejected</option>
            <option value="WITHDRAWN">Withdrawn</option>
          </select>
        </div>

        {(statusFilter || searchTerm) && (
          <button
            type="button"
            onClick={() => {
              setStatusFilter("");
              setSearchTerm("");
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
            Reset Filters
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
          <div style={{ padding: "3rem", textAlign: "center", color: "#94A3B8" }}>
            Loading your submission history…
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: "3rem", textAlign: "center" }}>
            <div style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>📄</div>
            <p style={{ fontWeight: 600, color: "#1F2937", margin: "0 0 0.25rem" }}>
              No submissions match your filters
            </p>
            <p style={{ fontSize: "0.82rem", color: "#64748B", margin: 0 }}>
              Try adjusting your search criteria or contribute a new voice recording.
            </p>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ minWidth: "750px", margin: 0, border: "none" }}>
              <thead>
                <tr>
                  <th>Submission ID</th>
                  <th>Language / Dialect</th>
                  <th>Mode</th>
                  <th>AI Hypothesis / Reference</th>
                  <th>Status</th>
                  <th>Submitted At</th>
                  <th style={{ textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((sub) => {
                  const isApproved = sub.status === "APPROVED";
                  const isPending = sub.status === "PENDING_REVIEW" || sub.status === "RECEIVED";
                  const isCorrection = sub.status === "NEEDS_CORRECTION";
                  const isWithdrawn = sub.status === "WITHDRAWN";

                  return (
                    <tr key={sub.id}>
                      <td>
                        <code style={{ fontSize: "0.78rem" }}>{sub.id}</code>
                      </td>
                      <td>
                        <span style={{ fontWeight: 600, color: "#1F2937" }}>{sub.language}</span>
                        {sub.dialect && (
                          <div style={{ fontSize: "0.72rem", color: "#64748B" }}>{sub.dialect}</div>
                        )}
                      </td>
                      <td>
                        <span
                          style={{
                            fontSize: "0.75rem",
                            fontWeight: 600,
                            color: sub.contribution_mode === "guided" ? "#4338CA" : "#0D9488",
                          }}
                        >
                          {sub.contribution_mode === "guided" ? "Guided" : "Natural"}
                        </span>
                      </td>
                      <td style={{ maxWidth: "260px" }}>
                        <div
                          style={{
                            fontSize: "0.82rem",
                            color: "#1F2937",
                            fontWeight: 500,
                            display: "-webkit-box",
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: "vertical",
                            overflow: "hidden",
                          }}
                        >
                          {sub.hypothesis_text || "—"}
                        </div>
                        {sub.reference_text && (
                          <div
                            style={{
                              fontSize: "0.72rem",
                              color: "#64748B",
                              marginTop: "0.2rem",
                              display: "-webkit-box",
                              WebkitLineClamp: 1,
                              WebkitBoxOrient: "vertical",
                              overflow: "hidden",
                            }}
                          >
                            Ref: {sub.reference_text}
                          </div>
                        )}
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
                              : isWithdrawn
                              ? "bl-badge-danger"
                              : "bl-badge-neutral"
                          }`}
                        >
                          {sub.status.replace("_", " ")}
                        </span>
                      </td>
                      <td style={{ fontSize: "0.78rem", color: "#64748B", whiteSpace: "nowrap" }}>
                        {new Date(sub.created_at).toLocaleDateString()}
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <button
                          type="button"
                          onClick={() => onSelectSubmission(sub.id)}
                          style={{
                            background: "#EFF6FF",
                            border: "1px solid #BFDBFE",
                            color: "#2563EB",
                            padding: "0.35rem 0.75rem",
                            borderRadius: "6px",
                            fontSize: "0.78rem",
                            fontWeight: 600,
                            cursor: "pointer",
                          }}
                        >
                          Inspect Details →
                        </button>
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
