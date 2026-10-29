import type { WerResult } from "../types";
import { StatusBadge } from "./StatusBadge";
import { formatWer, formatCount } from "../utils/wer";

interface DistrictCardProps {
  result: WerResult;
  onClick?: () => void;
  selected?: boolean;
}

const STATUS_EXPLANATIONS: Record<string, string> = {
  no_data: "No recordings have been collected for this group yet.",
  insufficient:
    "Too few recordings or reference words to produce a reliable WER estimate.",
  cannot_calculate:
    "All recordings in this group have zero reference words — WER cannot be computed.",
  high_wer:
    "WER is above the high-error threshold. Consider reviewing these recordings.",
  ok: "Sufficient data to compute WER.",
};

export function DistrictCard({ result, onClick, selected }: DistrictCardProps) {
  const canShowWer = result.wer_pct !== null;

  return (
    <article
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      aria-label={`District: ${result.district}, Status: ${result.status}`}
      onClick={onClick}
      onKeyDown={(e) => e.key === "Enter" && onClick?.()}
      style={{
        background: "#fff",
        border: selected ? "2px solid #6366f1" : "1px solid #e5e7eb",
        borderRadius: "0.75rem",
        padding: "1.25rem",
        cursor: onClick ? "pointer" : "default",
        transition: "box-shadow 0.15s, border-color 0.15s",
        boxShadow: selected
          ? "0 0 0 3px #6366f120"
          : "0 1px 3px rgba(0,0,0,0.06)",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.75rem" }}>
        <h3 style={{ margin: 0, fontSize: "1.05rem", fontWeight: 700, color: "#1f2937" }}>
          {result.district}
        </h3>
        <StatusBadge status={result.status} />
      </div>

      {/* WER score */}
      <div style={{ marginBottom: "0.75rem" }}>
        {canShowWer ? (
          <div style={{ display: "flex", alignItems: "baseline", gap: "0.4rem" }}>
            <span style={{ fontSize: "2rem", fontWeight: 800, color: "#1f2937" }}>
              {formatWer(result.wer_pct)}
            </span>
            <span style={{ fontSize: "0.8rem", color: "#6b7280" }}>WER</span>
          </div>
        ) : (
          <div style={{ fontSize: "1.3rem", fontWeight: 700, color: "#9ca3af" }}>
            —
          </div>
        )}
      </div>

      {/* Counts row */}
      <div
        style={{
          display: "flex",
          gap: "1rem",
          fontSize: "0.8rem",
          color: "#6b7280",
          marginBottom: "0.5rem",
        }}
      >
        <span>
          <strong style={{ color: "#374151" }}>{formatCount(result.recording_count)}</strong> recordings
        </span>
        <span>
          <strong style={{ color: "#374151" }}>{formatCount(result.reference_word_count)}</strong> ref words
        </span>
      </div>

      {/* Edit counts (only if we have data) */}
      {result.recording_count > 0 && (
        <div style={{ display: "flex", gap: "0.75rem", fontSize: "0.75rem", color: "#9ca3af" }}>
          <span>S: {result.substitutions}</span>
          <span>D: {result.deletions}</span>
          <span>I: {result.insertions}</span>
        </div>
      )}

      {/* Explanation */}
      <p style={{ margin: "0.75rem 0 0", fontSize: "0.75rem", color: "#9ca3af", lineHeight: 1.5 }}>
        {STATUS_EXPLANATIONS[result.status]}
      </p>
    </article>
  );
}
