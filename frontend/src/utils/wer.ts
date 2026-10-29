/**
 * Client-side WER helpers.
 * These mirror the backend logic and are used for display formatting only.
 * The source of truth for WER values is always the backend.
 */

import type { WerStatus } from "../types";

export const STATUS_LABELS: Record<WerStatus, string> = {
  no_data: "No Data",
  insufficient: "Insufficient Evidence",
  cannot_calculate: "Cannot Calculate",
  high_wer: "High WER",
  ok: "Evaluated",
};

export const STATUS_COLORS: Record<WerStatus, string> = {
  no_data: "#9ca3af",        // gray
  insufficient: "#f59e0b",   // amber
  cannot_calculate: "#ef4444", // red
  high_wer: "#f97316",       // orange
  ok: "#22c55e",             // green
};

export const STATUS_BG: Record<WerStatus, string> = {
  no_data: "#f3f4f6",
  insufficient: "#fffbeb",
  cannot_calculate: "#fef2f2",
  high_wer: "#fff7ed",
  ok: "#f0fdf4",
};

export function formatWer(wer_pct: number | null): string {
  if (wer_pct === null) return "—";
  return `${wer_pct.toFixed(1)}%`;
}

export function formatCount(n: number): string {
  return n.toLocaleString();
}
