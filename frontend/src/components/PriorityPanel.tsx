import type { CollectionPriority } from "../types";

interface PriorityPanelProps {
  priorities: CollectionPriority[];
  disclaimer: string;
  thresholds: { min_recordings: number; high_wer_threshold: number; recommended_target: number };
  onGiveFeedback?: (priority: CollectionPriority) => void;
}

const GAP_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  missing: { bg: "#fef2f2", text: "#dc2626", label: "Missing" },
  insufficient: { bg: "#fffbeb", text: "#d97706", label: "Insufficient" },
  high_wer: { bg: "#fff7ed", text: "#ea580c", label: "High WER" },
};

export function PriorityPanel({ priorities, disclaimer, thresholds, onGiveFeedback }: PriorityPanelProps) {
  if (priorities.length === 0) {
    return (
      <div style={{ padding: "2rem", textAlign: "center", color: "#9ca3af", background: "#f9fafb", borderRadius: "0.75rem" }}>
        <p style={{ margin: 0 }}>🎉 All groups have sufficient evidence and acceptable WER!</p>
        <p style={{ margin: "0.5rem 0 0", fontSize: "0.8rem" }}>
          (Thresholds: min {thresholds.min_recordings} recordings, high WER ≥ {thresholds.high_wer_threshold}%)
        </p>
      </div>
    );
  }

  return (
    <div>
      {/* Disclaimer */}
      <div
        role="note"
        aria-label="Data disclaimer"
        style={{
          background: "#f0f9ff",
          border: "1px solid #bae6fd",
          borderRadius: "0.5rem",
          padding: "0.75rem 1rem",
          marginBottom: "1rem",
          fontSize: "0.8rem",
          color: "#0369a1",
          lineHeight: 1.6,
        }}
      >
        <strong>ℹ Community Review Required:</strong> {disclaimer}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
        {priorities.map((p) => {
          const style = GAP_COLORS[p.gap_type];
          const progress = Math.min(p.recording_count / p.recommended_target, 1);

          return (
            <div
              key={`${p.district}|${p.gender}|${p.age_group}`}
              style={{
                background: "#fff",
                border: "1px solid #e5e7eb",
                borderRadius: "0.75rem",
                padding: "1rem",
                display: "grid",
                gridTemplateColumns: "auto 1fr auto",
                gap: "0.75rem",
                alignItems: "start",
              }}
            >
              {/* Rank */}
              <div
                aria-label={`Priority rank ${p.rank}`}
                style={{
                  width: "2rem",
                  height: "2rem",
                  borderRadius: "50%",
                  background: style.bg,
                  color: style.text,
                  fontWeight: 800,
                  fontSize: "0.85rem",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                {p.rank}
              </div>

              {/* Content */}
              <div>
                <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap", marginBottom: "0.35rem" }}>
                  <span style={{ fontWeight: 700, color: "#1f2937", fontSize: "0.9rem" }}>
                    {p.district}
                  </span>
                  <span style={{ color: "#6b7280", fontSize: "0.8rem" }}>·</span>
                  <span style={{ color: "#6b7280", fontSize: "0.8rem", textTransform: "capitalize" }}>{p.gender}</span>
                  <span style={{ color: "#6b7280", fontSize: "0.8rem" }}>·</span>
                  <span style={{ color: "#6b7280", fontSize: "0.8rem" }}>{p.age_group}</span>
                  <span
                    style={{
                      background: style.bg,
                      color: style.text,
                      fontSize: "0.68rem",
                      fontWeight: 700,
                      padding: "0.1rem 0.5rem",
                      borderRadius: "9999px",
                      border: `1px solid ${style.text}30`,
                    }}
                  >
                    {style.label}
                  </span>
                </div>

                <p style={{ margin: "0 0 0.5rem", fontSize: "0.8rem", color: "#6b7280", lineHeight: 1.5 }}>
                  {p.reason}
                </p>

                {/* Progress bar */}
                <div style={{ marginBottom: "0.25rem" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.72rem", color: "#9ca3af", marginBottom: "0.2rem" }}>
                    <span>{p.recording_count} / {p.recommended_target} recordings</span>
                    <span>{Math.round(progress * 100)}%</span>
                  </div>
                  <div style={{ height: "6px", background: "#f3f4f6", borderRadius: "3px", overflow: "hidden" }}>
                    <div
                      role="progressbar"
                      aria-valuenow={p.recording_count}
                      aria-valuemin={0}
                      aria-valuemax={p.recommended_target}
                      aria-label={`${p.recording_count} of ${p.recommended_target} recordings collected`}
                      style={{
                        height: "100%",
                        width: `${progress * 100}%`,
                        background: style.text,
                        borderRadius: "3px",
                        transition: "width 0.3s ease",
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Feedback button */}
              {onGiveFeedback && (
                <button
                  onClick={() => onGiveFeedback(p)}
                  aria-label={`Give community feedback on ${p.district} ${p.gender} ${p.age_group}`}
                  style={{
                    padding: "0.35rem 0.75rem",
                    fontSize: "0.78rem",
                    border: "1px solid #d1d5db",
                    borderRadius: "0.5rem",
                    background: "#fff",
                    color: "#6b7280",
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                    flexShrink: 0,
                  }}
                >
                  Review
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
