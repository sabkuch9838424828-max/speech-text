import { useEffect, useState } from "react";
import { api } from "../../api/client";
import type { User, UserStats, VoiceSubmission } from "../../types";

interface UserDashboardProps {
  user: User;
  onNavigate: (route: string) => void;
  onSelectSubmission: (submissionId: string) => void;
}

export function UserDashboard({ user, onNavigate, onSelectSubmission }: UserDashboardProps) {
  const [stats, setStats] = useState<UserStats | null>(null);
  const [recentSubs, setRecentSubs] = useState<VoiceSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    setLoading(true);

    Promise.all([
      api.userStats().catch(() => ({
        total_submissions: 0,
        pending_review: 0,
        approved: 0,
        needs_correction: 0,
        withdrawn: 0,
      })),
      api.userSubmissions({ limit: 5 }).catch(() => ({ submissions: [] })),
    ])
      .then(([statsData, subsData]) => {
        if (!mounted) return;
        setStats(statsData);
        setRecentSubs(subsData.submissions);
      })
      .catch((err) => {
        if (!mounted) return;
        setError(err.message || "Failed to load dashboard data");
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
      {/* Welcome Banner */}
      <div
        style={{
          background: "#FFFFFF",
          border: "1px solid #E2E8F0",
          borderRadius: "14px",
          padding: "1.75rem 2rem",
          marginBottom: "1.5rem",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "1.25rem",
          boxShadow: "0 1px 3px rgba(15, 23, 42, 0.05)",
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.35rem" }}>
            <span style={{ fontSize: "1.35rem" }}>👋</span>
            <h1 style={{ fontSize: "1.45rem", fontWeight: 800, color: "#1F2937", margin: 0 }}>
              Welcome, {user.name}
            </h1>
            <span
              style={{
                background: "#EFF6FF",
                color: "#2563EB",
                border: "1px solid #BFDBFE",
                fontSize: "0.72rem",
                fontWeight: 700,
                padding: "0.2rem 0.55rem",
                borderRadius: "9999px",
                textTransform: "uppercase",
              }}
            >
              {user.role} Contributor
            </span>
          </div>
          <p style={{ margin: 0, color: "#64748B", fontSize: "0.9rem" }}>
            Contribute voice recordings in regional Indian languages and track AI hypothesis validation.
          </p>
        </div>

        {/* Primary Action Button */}
        <div>
          <button
            type="button"
            onClick={() => onNavigate("/app/submit")}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.5rem",
              background: "#2563EB",
              color: "#FFFFFF",
              border: "none",
              borderRadius: "10px",
              padding: "0.75rem 1.4rem",
              fontSize: "0.95rem",
              fontWeight: 700,
              cursor: "pointer",
              boxShadow: "0 2px 4px rgba(37, 99, 235, 0.2)",
              transition: "all 0.15s ease",
            }}
          >
            <span>🎙️</span>
            <span>Submit New Input</span>
          </button>
        </div>
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

      {/* Metrics Ribbon (User's private submissions counts) */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: "1rem",
          marginBottom: "1.5rem",
        }}
      >
        {/* Total */}
        <div className="bl-card" style={{ background: "#FFFFFF" }}>
          <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: "0.4rem" }}>
            Total Submissions
          </div>
          <div style={{ fontSize: "1.85rem", fontWeight: 800, color: "#1F2937", lineHeight: 1 }}>
            {loading ? "…" : stats?.total_submissions ?? 0}
          </div>
          <div style={{ fontSize: "0.75rem", color: "#94A3B8", marginTop: "0.35rem" }}>
            Your lifetime contributions
          </div>
        </div>

        {/* Pending Review */}
        <div className="bl-card" style={{ background: "#FFFFFF", borderLeft: "4px solid #F59E0B" }}>
          <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "#D97706", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: "0.4rem" }}>
            Pending Review
          </div>
          <div style={{ fontSize: "1.85rem", fontWeight: 800, color: "#B45309", lineHeight: 1 }}>
            {loading ? "…" : stats?.pending_review ?? 0}
          </div>
          <div style={{ fontSize: "0.75rem", color: "#94A3B8", marginTop: "0.35rem" }}>
            Awaiting human linguist check
          </div>
        </div>

        {/* Approved */}
        <div className="bl-card" style={{ background: "#FFFFFF", borderLeft: "4px solid #10B981" }}>
          <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "#059669", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: "0.4rem" }}>
            Approved &amp; Verified
          </div>
          <div style={{ fontSize: "1.85rem", fontWeight: 800, color: "#065F46", lineHeight: 1 }}>
            {loading ? "…" : stats?.approved ?? 0}
          </div>
          <div style={{ fontSize: "0.75rem", color: "#94A3B8", marginTop: "0.35rem" }}>
            Included in benchmark datasets
          </div>
        </div>

        {/* Needs Correction / Attention */}
        <div className="bl-card" style={{ background: "#FFFFFF", borderLeft: "4px solid #6366F1" }}>
          <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "#4F46E5", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: "0.4rem" }}>
            Needs Correction
          </div>
          <div style={{ fontSize: "1.85rem", fontWeight: 800, color: "#3730A3", lineHeight: 1 }}>
            {loading ? "…" : stats?.needs_correction ?? 0}
          </div>
          <div style={{ fontSize: "0.75rem", color: "#94A3B8", marginTop: "0.35rem" }}>
            Low audio quality or disputed text
          </div>
        </div>
      </div>

      {/* Main Split: Recent Activity & Quick Guidance */}
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "1.5rem" }}>
        {/* Left Column: Recent Submissions */}
        <div
          style={{
            background: "#FFFFFF",
            border: "1px solid #E2E8F0",
            borderRadius: "14px",
            padding: "1.5rem",
            boxShadow: "0 1px 3px rgba(15, 23, 42, 0.05)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem" }}>
            <div>
              <h2 style={{ fontSize: "1.1rem", fontWeight: 700, color: "#1F2937", margin: "0 0 0.2rem" }}>
                Recent Voice Submissions
              </h2>
              <p style={{ fontSize: "0.8rem", color: "#64748B", margin: 0 }}>
                Real-time status of your speech contributions
              </p>
            </div>
            {recentSubs.length > 0 && (
              <button
                type="button"
                onClick={() => onNavigate("/app/submissions")}
                style={{
                  background: "#F1F5F9",
                  border: "1px solid #CBD5E1",
                  borderRadius: "6px",
                  padding: "0.35rem 0.75rem",
                  fontSize: "0.78rem",
                  fontWeight: 600,
                  color: "#334155",
                  cursor: "pointer",
                }}
              >
                View All →
              </button>
            )}
          </div>

          {loading ? (
            <div style={{ padding: "2rem", textAlign: "center", color: "#94A3B8", fontSize: "0.85rem" }}>
              Loading recent submissions…
            </div>
          ) : recentSubs.length === 0 ? (
            <div
              style={{
                border: "2px dashed #E2E8F0",
                borderRadius: "10px",
                padding: "2.5rem 1.5rem",
                textAlign: "center",
                background: "#F8FAFC",
              }}
            >
              <div style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>🎙️</div>
              <p style={{ fontWeight: 600, color: "#1F2937", margin: "0 0 0.35rem" }}>
                No submissions recorded yet
              </p>
              <p style={{ color: "#64748B", fontSize: "0.82rem", margin: "0 0 1rem" }}>
                Record your first regional sentence or natural speech note to test the pipeline.
              </p>
              <button
                type="button"
                onClick={() => onNavigate("/app/submit")}
                style={{
                  background: "#2563EB",
                  color: "#FFFFFF",
                  border: "none",
                  padding: "0.5rem 1rem",
                  borderRadius: "6px",
                  fontSize: "0.85rem",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                Contribute Voice Now
              </button>
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ minWidth: "550px" }}>
                <thead>
                  <tr>
                    <th>Ref ID</th>
                    <th>Language</th>
                    <th>Mode</th>
                    <th>AI Hypothesis</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {recentSubs.map((sub) => {
                    const isApproved = sub.status === "APPROVED";
                    const isPending = sub.status === "PENDING_REVIEW" || sub.status === "RECEIVED";
                    const isCorrection = sub.status === "NEEDS_CORRECTION";

                    return (
                      <tr key={sub.id}>
                        <td>
                          <code style={{ fontSize: "0.75rem" }}>{sub.id.slice(0, 8)}…</code>
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
                        <td style={{ maxWidth: "200px" }}>
                          <span
                            style={{
                              fontSize: "0.82rem",
                              color: "#334155",
                              display: "-webkit-box",
                              WebkitLineClamp: 2,
                              WebkitBoxOrient: "vertical",
                              overflow: "hidden",
                            }}
                          >
                            {sub.hypothesis_text || "—"}
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
                        <td>
                          <button
                            type="button"
                            onClick={() => onSelectSubmission(sub.id)}
                            style={{
                              background: "#F1F5F9",
                              border: "1px solid #CBD5E1",
                              color: "#2563EB",
                              padding: "0.3rem 0.6rem",
                              borderRadius: "4px",
                              fontSize: "0.75rem",
                              fontWeight: 600,
                              cursor: "pointer",
                            }}
                          >
                            Details
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

        {/* Right Column: Guidance & Safeguards Notice */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
          {/* Privacy Safeguards Card */}
          <div
            style={{
              background: "#FFFFFF",
              border: "1px solid #E2E8F0",
              borderRadius: "14px",
              padding: "1.25rem",
              boxShadow: "0 1px 3px rgba(15, 23, 42, 0.05)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.6rem" }}>
              <span style={{ fontSize: "1.1rem" }}>🛡️</span>
              <h3 style={{ fontSize: "0.95rem", fontWeight: 700, color: "#1F2937", margin: 0 }}>
                Data Privacy &amp; Consent
              </h3>
            </div>
            <p style={{ fontSize: "0.8rem", color: "#64748B", lineHeight: 1.55, margin: "0 0 0.75rem" }}>
              Your submissions are strictly bound to Policy v2.0. Audio recordings are stored in private storage and never exposed for public web scraping.
            </p>
            <ul style={{ margin: 0, paddingLeft: "1.2rem", fontSize: "0.78rem", color: "#475569", lineHeight: 1.6 }}>
              <li>Right to erasure via deletion tokens at any time.</li>
              <li>Only approved transcripts enter benchmark releases.</li>
              <li>Demographic attributes are strictly anonymized.</li>
            </ul>
          </div>

          {/* How Benchmarks Work */}
          <div
            style={{
              background: "#F0FDFA",
              border: "1px solid #CCFBF1",
              borderRadius: "14px",
              padding: "1.25rem",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.6rem" }}>
              <span style={{ fontSize: "1.1rem" }}>💡</span>
              <h3 style={{ fontSize: "0.95rem", fontWeight: 700, color: "#0F766E", margin: 0 }}>
                Next Verification Steps
              </h3>
            </div>
            <p style={{ fontSize: "0.8rem", color: "#115E59", lineHeight: 1.55, margin: 0 }}>
              After uploading audio, the ASR model produces an initial hypothesis. A human linguist verifies or corrects the transcript before the sample is frozen into a benchmark dataset version.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
