import type { WerResult } from "../types";
import { STATUS_STYLE, formatWer } from "../utils/wer";
import { StatusBadge } from "./StatusBadge";

interface DistrictCardProps {
  result: WerResult;
  onClick?: () => void;
}

export function DistrictCard({ result, onClick }: DistrictCardProps) {
  const s = STATUS_STYLE[result.status];
  const hasWer = result.wer_pct !== null;
  const total = result.substitutions + result.deletions + result.insertions;

  return (
    <div
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => e.key === "Enter" && onClick() : undefined}
      aria-label={`${result.district}: ${s.label}${hasWer ? `, WER ${formatWer(result.wer_pct)}` : ""}`}
      style={{
        background: s.bg,
        border: `1px solid ${s.border}`,
        borderRadius: "0.75rem",
        padding: "1rem",
        cursor: onClick ? "pointer" : "default",
        transition: "transform 0.1s, box-shadow 0.1s",
      }}
      onMouseEnter={(e) => {
        if (onClick) {
          (e.currentTarget as HTMLDivElement).style.transform = "translateY(-2px)";
          (e.currentTarget as HTMLDivElement).style.boxShadow = "0 4px 12px rgba(0,0,0,0.08)";
        }
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLDivElement).style.transform = "";
        (e.currentTarget as HTMLDivElement).style.boxShadow = "";
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.5rem" }}>
        <h3 style={{ margin: 0, fontSize: "0.9rem", fontWeight: 700, color: "#1f2937" }}>
          {result.district}
        </h3>
        <StatusBadge status={result.status} compact />
      </div>

      {hasWer ? (
        <div style={{ fontSize: "1.8rem", fontWeight: 800, color: s.text, lineHeight: 1.1 }}>
          {formatWer(result.wer_pct)}
        </div>
      ) : (
        <div style={{ fontSize: "1.1rem", fontWeight: 700, color: s.text }}>—</div>
      )}

      <div style={{ marginTop: "0.5rem", display: "flex", gap: "0.75rem", fontSize: "0.72rem", color: "#6b7280", flexWrap: "wrap" }}>
        <span>k={result.recording_count}</span>
        <span>W={result.reference_word_count.toLocaleString()}</span>
        {hasWer && total > 0 && (
          <>
            <span>S={result.substitutions}</span>
            <span>D={result.deletions}</span>
            <span>I={result.insertions}</span>
          </>
        )}
      </div>

      {result.gender && (
        <div style={{ marginTop: "0.3rem", fontSize: "0.7rem", color: "#9ca3af" }}>
          {result.gender} · {result.age_group}
        </div>
      )}
    </div>
  );
}
