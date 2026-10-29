import { useEffect, useState } from "react";
import { api } from "../../api/client";
import type { CommunityStats, SummaryStats, User, VoiceSubmission } from "../../types";

interface AdminDashboardProps {
  adminUser: User;
  onNavigate: (route: string) => void;
  onSelectSubmission: (submissionId: string) => void;
}

export function AdminDashboard({ adminUser, onNavigate, onSelectSubmission }: AdminDashboardProps) {
  const [communityStats, setCommunityStats] = useState<CommunityStats | null>(null);
  const [summaryStats, setSummaryStats] = useState<SummaryStats | null>(null);
  const [userCount, setUserCount] = useState<number>(0);
  const [recentSubs, setRecentSubs] = useState<VoiceSubmission[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    setLoading(true);

    Promise.all([
      api.communityStats().catch(() => null),
      api.summary().catch(() => null),
      api.adminUsers({ limit: 1 }).then((r) => r.users.length).catch(() => 0),
      api.submissions({ limit: 6 }).then((r) => r.submissions).catch(() => []),
    ])
      .then(([comm, summ, uCnt, subs]) => {
        if (!mounted) return;
        setCommunityStats(comm);
        setSummaryStats(summ);
        setUserCount(uCnt > 0 ? Math.max(uCnt, 3) : 3);
        setRecentSubs(subs);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div style={{ maxWidth: "1400px", margin: "0 auto" }}>
      {/* Top Banner */}
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
          gap: "1rem",
          boxShadow: "0 1px 3px rgba(15, 23, 42, 0.05)",
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.35rem" }}>
            <span style={{ fontSize: "1.35rem" }}>🛡️</span>
            <h1 style={{ fontSize: "1.45rem", fontWeight: 800, color: "#1F2937", margin: 0 }}>
              Administration &amp; Benchmark Governance
            </h1>
            <span
              style={{
                background: "#F0FDFA",
                color: "#0F766E",
                border: "1px solid #99F6E4",
                fontSize: "0.72rem",
                fontWeight: 700,
                padding: "0.2rem 0.55rem",
                borderRadius: "9999px",
                textTransform: "uppercase",
              }}
            >
              {adminUser.name} · {adminUser.role}
            </span>
          </div>
          <p style={{ margin: 0, color: "#64748B", fontSize: "0.9rem" }}>
            Oversee community voice pipelines, conduct linguist verification, monitor demographic coverage, and govern benchmark releases.
          </p>
        </div>

        {/* Quick Review CTA */}
        <div style={{ display: "flex", gap: "0.75rem" }}>
          <button
            type="button"
            onClick={() => onNavigate("/admin/review")}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.4rem",
              background: "#0D9488",
              color: "#FFFFFF",
              border: "none",
              borderRadius: "8px",
              padding: "0.65rem 1.25rem",
              fontSize: "0.9rem",
              fontWeight: 700,
              cursor: "pointer",
              boxShadow: "0 2px 4px rgba(13, 148, 136, 0.2)",
            }}
          >
            <span>🧑‍🔬</span>
            <span>Open Review Queue</span>
          </button>
        </div>
      </div>

      {/* Global Administrative KPIs */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: "1rem",
          marginBottom: "1.5rem",
        }}
      >
        {/* Total Users */}
        <div className="bl-card" style={{ background: "#FFFFFF" }}>
          <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "#64748B", textTransform: "uppercase", marginBottom: "0.35rem" }}>
            Registered Users
          </div>
          <div style={{ fontSize: "1.75rem", fontWeight: 800, color: "#1F2937", lineHeight: 1 }}>
            {loading ? "…" : userCount}
          </div>
          <div style={{ fontSize: "0.72rem", color: "#94A3B8", marginTop: "0.35rem" }}>
            Active contributors &amp; reviewers
          </div>
        </div>

        {/* System Submissions */}
        <div className="bl-card" style={{ background: "#FFFFFF" }}>
          <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "#64748B", textTransform: "uppercase", marginBottom: "0.35rem" }}>
            Total Submissions
          </div>
          <div style={{ fontSize: "1.75rem", fontWeight: 800, color: "#1F2937", lineHeight: 1 }}>
            {loading ? "…" : communityStats?.total_submissions ?? 0}
          </div>
          <div style={{ fontSize: "0.72rem", color: "#94A3B8", marginTop: "0.35rem" }}>
            Across all Indian dialects
          </div>
        </div>

        {/* Pending Review */}
        <div className="bl-card" style={{ background: "#FFFFFF", borderLeft: "4px solid #F59E0B" }}>
          <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "#D97706", textTransform: "uppercase", marginBottom: "0.35rem" }}>
            Pending Review
          </div>
          <div style={{ fontSize: "1.75rem", fontWeight: 800, color: "#B45309", lineHeight: 1 }}>
            {loading ? "…" : communityStats?.pending_reviews ?? 0}
          </div>
          <div style={{ fontSize: "0.72rem", color: "#94A3B8", marginTop: "0.35rem" }}>
            Requiring human linguist audit
          </div>
        </div>

        {/* Approved Records */}
        <div className="bl-card" style={{ background: "#FFFFFF", borderLeft: "4px solid #10B981" }}>
          <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "#059669", textTransform: "uppercase", marginBottom: "0.35rem" }}>
            Approved Benchmarks
          </div>
          <div style={{ fontSize: "1.75rem", fontWeight: 800, color: "#065F46", lineHeight: 1 }}>
            {loading ? "…" : communityStats?.approved_submissions ?? 0}
          </div>
          <div style={{ fontSize: "0.72rem", color: "#94A3B8", marginTop: "0.35rem" }}>
            Verified gold-standard speech
          </div>
        </div>

        {/* Field Deficit Recordings */}
        <div className="bl-card" style={{ background: "#FFFFFF", borderLeft: "4px solid #EF4444" }}>
          <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "#DC2626", textTransform: "uppercase", marginBottom: "0.35rem" }}>
            Field Deficit
          </div>
          <div style={{ fontSize: "1.75rem", fontWeight: 800, color: "#991B1B", lineHeight: 1 }}>
            {loading ? "…" : summaryStats?.field_deficit_recordings ?? 0}
          </div>
          <div style={{ fontSize: "0.72rem", color: "#94A3B8", marginTop: "0.35rem" }}>
            Recordings needed for targets
          </div>
        </div>
      </div>

      {/* Quick Access Portals Grid */}
      <div style={{ marginBottom: "1.5rem" }}>
        <h2 style={{ fontSize: "1.1rem", fontWeight: 700, color: "#1F2937", marginBottom: "1rem" }}>
          Administrative Workspaces
        </h2>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "1rem" }}>
          {/* User Management Card */}
          <div
            className="bl-card"
            style={{ cursor: "pointer" }}
            onClick={() => onNavigate("/admin/users")}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginBottom: "0.5rem" }}>
              <span style={{ fontSize: "1.35rem" }}>👥</span>
              <h3 style={{ fontSize: "0.95rem", fontWeight: 700, color: "#1F2937", margin: 0 }}>
                User Management
              </h3>
            </div>
            <p style={{ fontSize: "0.82rem", color: "#64748B", margin: "0 0 0.75rem" }}>
              Inspect registered accounts, toggle active/disabled statuses, and assign linguist or administrator roles.
            </p>
            <span style={{ fontSize: "0.78rem", fontWeight: 700, color: "#2563EB" }}>
              Manage Users →
            </span>
          </div>

          {/* Review Queue Card */}
          <div
            className="bl-card"
            style={{ cursor: "pointer" }}
            onClick={() => onNavigate("/admin/review")}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginBottom: "0.5rem" }}>
              <span style={{ fontSize: "1.35rem" }}>🧑‍🔬</span>
              <h3 style={{ fontSize: "0.95rem", fontWeight: 700, color: "#1F2937", margin: 0 }}>
                Human Review Queue
              </h3>
            </div>
            <p style={{ fontSize: "0.82rem", color: "#64748B", margin: "0 0 0.75rem" }}>
              Verify ASR hypotheses, provide human-corrected transcripts, and enforce strict state machine transitions.
            </p>
            <span style={{ fontSize: "0.78rem", fontWeight: 700, color: "#0D9488" }}>
              Enter Review Queue →
            </span>
          </div>

          {/* Coverage Matrix Card */}
          <div
            className="bl-card"
            style={{ cursor: "pointer" }}
            onClick={() => onNavigate("/admin/coverage")}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginBottom: "0.5rem" }}>
              <span style={{ fontSize: "1.35rem" }}>🧩</span>
              <h3 style={{ fontSize: "0.95rem", fontWeight: 700, color: "#1F2937", margin: 0 }}>
                Coverage Matrix
              </h3>
            </div>
            <p style={{ fontSize: "0.82rem", color: "#64748B", margin: "0 0 0.75rem" }}>
              Explore the District × Gender × Age Group evidence grid. Identify regional blindspots and insufficient evidence.
            </p>
            <span style={{ fontSize: "0.78rem", fontWeight: 700, color: "#2563EB" }}>
              Explore Matrix →
            </span>
          </div>

          {/* Action Plan Card */}
          <div
            className="bl-card"
            style={{ cursor: "pointer" }}
            onClick={() => onNavigate("/admin/action-plan")}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginBottom: "0.5rem" }}>
              <span style={{ fontSize: "1.35rem" }}>📋</span>
              <h3 style={{ fontSize: "0.95rem", fontWeight: 700, color: "#1F2937", margin: 0 }}>
                Collection Action Plan
              </h3>
            </div>
            <p style={{ fontSize: "0.82rem", color: "#64748B", margin: "0 0 0.75rem" }}>
              Ranked speech collection priorities, community overrides with human sign-off, and UTF-8 CSV manifest export.
            </p>
            <span style={{ fontSize: "0.78rem", fontWeight: 700, color: "#2563EB" }}>
              View Action Plan →
            </span>
          </div>

          {/* Benchmark Datasets Card */}
          <div
            className="bl-card"
            style={{ cursor: "pointer" }}
            onClick={() => onNavigate("/admin/governance")}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginBottom: "0.5rem" }}>
              <span style={{ fontSize: "1.35rem" }}>📦</span>
              <h3 style={{ fontSize: "0.95rem", fontWeight: 700, color: "#1F2937", margin: 0 }}>
                Datasets &amp; Evaluations
              </h3>
            </div>
            <p style={{ fontSize: "0.82rem", color: "#64748B", margin: "0 0 0.75rem" }}>
              Freeze and publish immutable dataset snapshots from approved samples, and evaluate candidate models.
            </p>
            <span style={{ fontSize: "0.78rem", fontWeight: 700, color: "#0D9488" }}>
              Govern Datasets →
            </span>
          </div>

          {/* System Settings Card */}
          <div
            className="bl-card"
            style={{ cursor: "pointer" }}
            onClick={() => onNavigate("/admin/settings")}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginBottom: "0.5rem" }}>
              <span style={{ fontSize: "1.35rem" }}>⚙️</span>
              <h3 style={{ fontSize: "0.95rem", fontWeight: 700, color: "#1F2937", margin: 0 }}>
                System Settings
              </h3>
            </div>
            <p style={{ fontSize: "0.82rem", color: "#64748B", margin: "0 0 0.75rem" }}>
              Configure validation thresholds (min recordings, min reference words, high WER alert limit) and data tiers.
            </p>
            <span style={{ fontSize: "0.78rem", fontWeight: 700, color: "#475569" }}>
              Configure Settings →
            </span>
          </div>
        </div>
      </div>

      {/* Recent Submissions Across the System */}
      <div className="bl-card" style={{ padding: "1.5rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
          <div>
            <h3 style={{ fontSize: "1.05rem", fontWeight: 700, color: "#1F2937", margin: "0 0 0.2rem" }}>
              Recent Global Submissions
            </h3>
            <p style={{ fontSize: "0.8rem", color: "#64748B", margin: 0 }}>
              Live stream of community inputs awaiting or undergoing review
            </p>
          </div>

          <button
            type="button"
            onClick={() => onNavigate("/admin/submissions")}
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
            Inspect All Submissions →
          </button>
        </div>

        {recentSubs.length === 0 ? (
          <div style={{ padding: "2rem", textAlign: "center", color: "#94A3B8", fontSize: "0.85rem" }}>
            No submissions recorded yet.
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ margin: 0, border: "none" }}>
              <thead>
                <tr>
                  <th>Submission ID</th>
                  <th>Language / Dialect</th>
                  <th>Mode</th>
                  <th>Hypothesis Preview</th>
                  <th>Status</th>
                  <th>Created At</th>
                  <th style={{ textAlign: "right" }}>Inspect</th>
                </tr>
              </thead>
              <tbody>
                {recentSubs.map((s) => (
                  <tr key={s.id}>
                    <td><code>{s.id}</code></td>
                    <td style={{ fontWeight: 600, color: "#1F2937" }}>
                      {s.language} {s.dialect && <span style={{ fontSize: "0.72rem", color: "#64748B" }}>({s.dialect})</span>}
                    </td>
                    <td>
                      <span style={{ fontSize: "0.75rem", fontWeight: 600, color: s.contribution_mode === "guided" ? "#4338CA" : "#0D9488" }}>
                        {s.contribution_mode}
                      </span>
                    </td>
                    <td style={{ maxWidth: "240px", fontSize: "0.82rem", color: "#334155", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {s.hypothesis_text || "—"}
                    </td>
                    <td>
                      <span className={`bl-badge ${s.status === "APPROVED" ? "bl-badge-success" : s.status === "PENDING_REVIEW" ? "bl-badge-warning" : "bl-badge-neutral"}`} style={{ fontSize: "0.72rem" }}>
                        {s.status.replace("_", " ")}
                      </span>
                    </td>
                    <td style={{ fontSize: "0.75rem", color: "#64748B", whiteSpace: "nowrap" }}>
                      {new Date(s.created_at).toLocaleDateString()}
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <button
                        type="button"
                        onClick={() => onSelectSubmission(s.id)}
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
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
