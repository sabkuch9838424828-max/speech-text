import type { CommunityStats } from "../types";

interface CommunityMetricsRibbonProps {
  stats: CommunityStats | null;
  loading: boolean;
}

export function CommunityMetricsRibbon({ stats, loading }: CommunityMetricsRibbonProps) {
  if (loading || !stats) {
    return (
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: "0.75rem",
          marginBottom: "1.5rem",
        }}
      >
        {[...Array(6)].map((_, i) => (
          <div
            key={i}
            style={{
              background: "#f8fafc",
              border: "1px solid #e2e8f0",
              borderRadius: "0.75rem",
              padding: "1rem",
              height: 75,
              animation: "pulse 1.5s infinite",
            }}
          />
        ))}
      </div>
    );
  }

  const cards = [
    {
      label: "Total Submissions",
      value: stats.total_submissions.toLocaleString(),
      subtext: `${stats.with_reference_transcript} guided · ${stats.without_reference_transcript} natural`,
      color: "#4f46e5",
      bg: "#eef2ff",
    },
    {
      label: "Pending Human Review",
      value: stats.pending_reviews.toLocaleString(),
      subtext: `${stats.needs_correction} flagged for correction`,
      color: "#d97706",
      bg: "#fffbeb",
    },
    {
      label: "Approved & Verified",
      value: stats.approved_submissions.toLocaleString(),
      subtext: `${stats.rejected_submissions} rejected · ${stats.withdrawn_submissions} purged`,
      color: "#16a34a",
      bg: "#f0fdf4",
    },
    {
      label: "Verified Ground-Truth WER",
      value: stats.verified_wer_pct !== null ? `${stats.verified_wer_pct.toFixed(1)}%` : "Pending Data",
      subtext: `S: ${stats.substitutions} · D: ${stats.deletions} · I: ${stats.insertions}`,
      color: "#0891b2",
      bg: "#ecfeff",
    },
    {
      label: "Language Coverage",
      value: `${stats.language_coverage.length} Languages`,
      subtext: stats.language_coverage.slice(0, 3).map((l) => `${l.language} (${l.count})`).join(", ") || "No languages yet",
      color: "#9333ea",
      bg: "#faf5ff",
    },
    {
      label: "Active Benchmark Version",
      value: stats.active_benchmark_version,
      subtext: stats.last_publication_timestamp
        ? `Published: ${new Date(stats.last_publication_timestamp).toLocaleDateString()}`
        : "Illustrative Baseline",
      color: "#2563eb",
      bg: "#eff6ff",
    },
  ];

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
        gap: "0.75rem",
        marginBottom: "1.5rem",
      }}
    >
      {cards.map((card) => (
        <div
          key={card.label}
          style={{
            background: "#fff",
            border: `1px solid ${card.color}22`,
            borderRadius: "0.75rem",
            padding: "0.85rem 1rem",
            boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
          }}
        >
          <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>
            {card.label}
          </div>
          <div style={{ fontSize: "1.4rem", fontWeight: 800, color: card.color, margin: "0.25rem 0" }}>
            {card.value}
          </div>
          <div style={{ fontSize: "0.7rem", color: "#94a3b8", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {card.subtext}
          </div>
        </div>
      ))}
    </div>
  );
}
