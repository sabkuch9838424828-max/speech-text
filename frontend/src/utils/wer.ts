/**
 * Client-side WER helpers — v0.2
 * Source of truth for WER values is always the backend.
 * This module provides display utilities and color palette only.
 */

import type { WerStatus } from "../types";

export interface StatusStyle {
  bg: string;
  text: string;
  border: string;
  label: string;
  emoji: string;
}

export const STATUS_STYLE: Record<WerStatus, StatusStyle> = {
  no_data: {
    bg: "#f1f5f9",
    text: "#475569",
    border: "#cbd5e1",
    label: "No Data",
    emoji: "⚪",
  },
  insufficient: {
    bg: "#fffbeb",
    text: "#92400e",
    border: "#fcd34d",
    label: "Insufficient Evidence",
    emoji: "🟡",
  },
  cannot_calculate: {
    bg: "#faf5ff",
    text: "#7c3aed",
    border: "#e9d5ff",
    label: "Cannot Calculate",
    emoji: "🟣",
  },
  high_wer: {
    bg: "#fff1f2",
    text: "#9f1239",
    border: "#fda4af",
    label: "High WER",
    emoji: "🔴",
  },
  ok: {
    bg: "#ecfdf5",
    text: "#065f46",
    border: "#6ee7b7",
    label: "Evaluated",
    emoji: "🟢",
  },
};

// Legacy aliases kept for backward-compat with old components
export const STATUS_LABELS: Record<WerStatus, string> = Object.fromEntries(
  Object.entries(STATUS_STYLE).map(([k, v]) => [k, v.label])
) as Record<WerStatus, string>;

export const STATUS_COLORS: Record<WerStatus, string> = {
  no_data: "#64748b",
  insufficient: "#d97706",
  cannot_calculate: "#7c3aed",
  high_wer: "#e11d48",
  ok: "#059669",
};

export const STATUS_BG: Record<WerStatus, string> = Object.fromEntries(
  Object.entries(STATUS_STYLE).map(([k, v]) => [k, v.bg])
) as Record<WerStatus, string>;

/** S/D/I error type colors */
export const EDIT_COLORS = {
  substitutions: "#f97316",  // orange
  deletions: "#ef4444",      // red
  insertions: "#8b5cf6",     // violet
} as const;

export function formatWer(wer_pct: number | null): string {
  if (wer_pct === null) return "—";
  return `${wer_pct.toFixed(1)}%`;
}

export function formatCount(n: number): string {
  return n.toLocaleString();
}
