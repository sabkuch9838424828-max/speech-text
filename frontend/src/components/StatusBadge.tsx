import type { WerStatus } from "../types";
import { STATUS_STYLE } from "../utils/wer";

interface StatusBadgeProps {
  status: WerStatus;
  compact?: boolean;
}

export function StatusBadge({ status, compact }: StatusBadgeProps) {
  const s = STATUS_STYLE[status];
  return (
    <span
      aria-label={s.label}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "0.25rem",
        background: s.bg,
        color: s.text,
        border: `1px solid ${s.border}`,
        borderRadius: "9999px",
        padding: compact ? "0.1rem 0.45rem" : "0.2rem 0.6rem",
        fontSize: compact ? "0.68rem" : "0.75rem",
        fontWeight: 700,
        whiteSpace: "nowrap",
      }}
    >
      <span aria-hidden="true">{s.emoji}</span>
      {!compact && s.label}
    </span>
  );
}
