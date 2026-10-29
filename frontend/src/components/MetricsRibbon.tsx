import type { SummaryStats } from "../types";

interface MetricsRibbonProps {
  stats: SummaryStats | null;
  loading?: boolean;
}

interface StatCard {
  label: string;
  getValue: (s: SummaryStats) => string;
  getSub: (s: SummaryStats) => string;
  accent: string;
  bg: string;
  icon: string;
}

const CARDS: StatCard[] = [
  {
    label: "Total Districts",
    getValue: (s) => String(s.total_districts),
    getSub: (s) => `${s.total_cohort_cells} cohort cells`,
    accent: "#3b82f6",
    bg: "#eff6ff",
    icon: "🏛️",
  },
  {
    label: "Validated Cohorts",
    getValue: (s) => String(s.validated_cohorts),
    getSub: (s) => `${s.validated_pct.toFixed(0)}% of cells`,
    accent: "#059669",
    bg: "#ecfdf5",
    icon: "✅",
  },
  {
    label: "High WER Alerts",
    getValue: (s) => String(s.high_wer_alerts),
    getSub: (s) => `${s.high_wer_pct.toFixed(0)}% of cells`,
    accent: "#e11d48",
    bg: "#fff1f2",
    icon: "🚨",
  },
  {
    label: "Blindspots",
    getValue: (s) => String(s.blindspots),
    getSub: (s) => `${s.blindspots_pct.toFixed(0)}% have no data`,
    accent: "#475569",
    bg: "#f1f5f9",
    icon: "⚪",
  },
  {
    label: "Field Deficit",
    getValue: (s) => `${s.field_deficit_recordings}`,
    getSub: (_s) => "recordings needed",
    accent: "#d97706",
    bg: "#fffbeb",
    icon: "📋",
  },
];

export function MetricsRibbon({ stats, loading }: MetricsRibbonProps) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
        gap: "0.75rem",
        padding: "0.75rem 1.5rem",
        background: "#fff",
        borderBottom: "1px solid #e5e7eb",
      }}
    >
      {CARDS.map((card) => (
        <div
          key={card.label}
          style={{
            background: card.bg,
            borderRadius: "0.75rem",
            border: `1px solid ${card.accent}22`,
            padding: "0.75rem 1rem",
            display: "flex",
            flexDirection: "column",
            gap: "0.2rem",
          }}
        >
          <div style={{ fontSize: "0.72rem", color: "#6b7280", fontWeight: 600, display: "flex", gap: "0.3rem", alignItems: "center" }}>
            <span>{card.icon}</span>
            <span style={{ textTransform: "uppercase", letterSpacing: "0.04em" }}>{card.label}</span>
          </div>
          <div style={{ fontSize: "1.5rem", fontWeight: 800, color: card.accent, lineHeight: 1.1 }}>
            {loading || !stats ? (
              <span style={{ fontSize: "0.9rem", color: "#9ca3af" }}>—</span>
            ) : (
              card.getValue(stats)
            )}
          </div>
          <div style={{ fontSize: "0.72rem", color: "#9ca3af" }}>
            {loading || !stats ? "" : card.getSub(stats)}
          </div>
        </div>
      ))}
    </div>
  );
}
