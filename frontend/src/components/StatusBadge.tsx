import type { WerStatus } from "../types";
import { STATUS_LABELS, STATUS_COLORS, STATUS_BG } from "../utils/wer";

interface StatusBadgeProps {
  status: WerStatus;
  size?: "sm" | "md";
}

export function StatusBadge({ status, size = "md" }: StatusBadgeProps) {
  const padding = size === "sm" ? "0.15rem 0.5rem" : "0.25rem 0.75rem";
  const fontSize = size === "sm" ? "0.7rem" : "0.78rem";

  return (
    <span
      role="status"
      aria-label={`Status: ${STATUS_LABELS[status]}`}
      style={{
        display: "inline-block",
        padding,
        fontSize,
        fontWeight: 600,
        borderRadius: "9999px",
        backgroundColor: STATUS_BG[status],
        color: STATUS_COLORS[status],
        border: `1px solid ${STATUS_COLORS[status]}40`,
        letterSpacing: "0.02em",
        whiteSpace: "nowrap",
      }}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}
