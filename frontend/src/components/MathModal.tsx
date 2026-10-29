import type { WerCellDetail } from "../types";

interface MathModalProps {
  cell: WerCellDetail;
  onClose: () => void;
}

export function MathModal({ cell, onClose }: MathModalProps) {
  const { wer_pct, naive_average_wer_pct, substitutions, deletions, insertions, reference_word_count } = cell;
  const totalEdits = substitutions + deletions + insertions;
  const naiveDiffers =
    naive_average_wer_pct !== null &&
    wer_pct !== null &&
    Math.abs(naive_average_wer_pct - wer_pct) >= 0.5;

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.5)",
          zIndex: 40,
        }}
        aria-hidden="true"
      />

      {/* Modal */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="math-modal-title"
        style={{
          position: "fixed",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          zIndex: 50,
          background: "#fff",
          borderRadius: "1rem",
          padding: "1.5rem",
          maxWidth: "480px",
          width: "calc(100vw - 2rem)",
          boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1rem" }}>
          <div>
            <h2 id="math-modal-title" style={{ margin: 0, fontSize: "1rem", fontWeight: 800, color: "#1f2937" }}>
              🔬 WER Math Integrity
            </h2>
            <p style={{ margin: "0.2rem 0 0", fontSize: "0.78rem", color: "#6b7280" }}>
              {cell.district} · {cell.gender} · {cell.age_group}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close math modal"
            style={{
              background: "none",
              border: "none",
              fontSize: "1.25rem",
              cursor: "pointer",
              color: "#9ca3af",
              lineHeight: 1,
              padding: "0.25rem",
            }}
          >
            ×
          </button>
        </div>

        {/* Formula */}
        <div
          style={{
            background: "#f8fafc",
            border: "1px solid #e2e8f0",
            borderRadius: "0.75rem",
            padding: "1rem",
            marginBottom: "1rem",
            fontFamily: "monospace",
          }}
        >
          <div style={{ fontSize: "0.75rem", color: "#64748b", marginBottom: "0.5rem", fontFamily: "system-ui" }}>
            True Aggregate WER Formula:
          </div>
          <div style={{ fontSize: "0.9rem", color: "#1e293b", lineHeight: 1.7 }}>
            <div>WER = Σ(S + D + I) / Σ(N)</div>
            <div style={{ color: "#6366f1" }}>
              = ({substitutions} + {deletions} + {insertions}) / {reference_word_count.toLocaleString()}
            </div>
            <div style={{ color: "#059669", fontWeight: 700 }}>
              = {totalEdits} / {reference_word_count.toLocaleString()} ={" "}
              {wer_pct !== null ? `${wer_pct.toFixed(2)}%` : "—"}
            </div>
          </div>
        </div>

        {/* Error counts */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: "0.5rem", marginBottom: "1rem" }}>
          {[
            { label: "Substitutions", value: substitutions, color: "#f97316" },
            { label: "Deletions", value: deletions, color: "#ef4444" },
            { label: "Insertions", value: insertions, color: "#8b5cf6" },
            { label: "Ref. Words", value: reference_word_count, color: "#3b82f6" },
          ].map(({ label, value, color }) => (
            <div
              key={label}
              style={{
                background: `${color}11`,
                border: `1px solid ${color}33`,
                borderRadius: "0.5rem",
                padding: "0.5rem",
                textAlign: "center",
              }}
            >
              <div style={{ fontSize: "1.1rem", fontWeight: 800, color }}>{value.toLocaleString()}</div>
              <div style={{ fontSize: "0.62rem", color: "#9ca3af" }}>{label}</div>
            </div>
          ))}
        </div>

        {/* Naive vs True comparison */}
        {naiveDiffers && (
          <div
            role="alert"
            style={{
              background: "#fffbeb",
              border: "1px solid #fcd34d",
              borderRadius: "0.75rem",
              padding: "0.75rem 1rem",
              fontSize: "0.8rem",
              color: "#92400e",
              lineHeight: 1.6,
            }}
          >
            <strong>⚠ Math Integrity Alert:</strong> If you averaged individual cohort WERs, you'd
            get <strong>{naive_average_wer_pct!.toFixed(1)}%</strong>. BhashaLens uses true
            edit-sum aggregation to prevent small-sample distortion →{" "}
            <strong>{wer_pct!.toFixed(1)}%</strong> (difference:{" "}
            {Math.abs(naive_average_wer_pct! - wer_pct!).toFixed(1)} pp).
          </div>
        )}

        <button
          onClick={onClose}
          style={{
            marginTop: "1rem",
            width: "100%",
            padding: "0.6rem",
            background: "#6366f1",
            color: "#fff",
            border: "none",
            borderRadius: "0.5rem",
            fontWeight: 700,
            fontSize: "0.875rem",
            cursor: "pointer",
          }}
        >
          Close
        </button>
      </div>
    </>
  );
}
