/**
 * LanguageDistributionChart
 * Shows per-language recording count + WER as a grouped bar chart,
 * with age-group breakdown toggleable below.
 * ⚠ ILLUSTRATIVE DEMO DATA
 */
import { useState } from "react";
import type { LanguageStat } from "../types";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer, Cell, LabelList,
} from "recharts";

// Distinct palette for up to 12 languages
const LANG_COLORS = [
  "#6366f1", "#f97316", "#10b981", "#f43f5e", "#8b5cf6",
  "#06b6d4", "#eab308", "#ec4899", "#14b8a6", "#f59e0b",
  "#84cc16", "#3b82f6",
];

interface Props {
  languages: LanguageStat[];
  selectedAgeGroup?: string;
  title?: string;
}

const AGE_GROUPS = ["18-30", "31-50", "51+"];
const AGE_COLORS: Record<string, string> = {
  "18-30": "#6366f1",
  "31-50": "#f97316",
  "51+":   "#e11d48",
};

export function LanguageDistributionChart({ languages, selectedAgeGroup, title }: Props) {
  const [view, setView] = useState<"count" | "wer">("count");
  const [expandAge, setExpandAge] = useState(false);

  if (languages.length === 0) {
    return (
      <div style={{ padding: "1.5rem", textAlign: "center", color: "#9ca3af", fontSize: "0.85rem" }}>
        No language data for this selection.
      </div>
    );
  }

  // ── Count view: horizontal bar per language ───────────────────────────────
  const countData = languages.map((l, i) => ({
    language: l.language,
    count: l.recording_count,
    color: LANG_COLORS[i % LANG_COLORS.length],
    wer: l.wer_pct,
  }));

  // ── WER view: grouped bar per language × age_group ────────────────────────
  const werData = languages.map((l) => {
    const row: Record<string, number | string | null> = { language: l.language };
    AGE_GROUPS.forEach((ag) => {
      row[ag] = l.breakdown_by_age[ag]?.wer_pct ?? null;
    });
    return row;
  });

  // ── Age breakdown table ───────────────────────────────────────────────────
  const ageTableData = languages.map((l) => ({
    language: l.language,
    ages: AGE_GROUPS.map((ag) => ({
      ag,
      count: l.breakdown_by_age[ag]?.recording_count ?? 0,
      wer: l.breakdown_by_age[ag]?.wer_pct ?? null,
    })),
  }));

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem", flexWrap: "wrap", gap: "0.5rem" }}>
        <h3 style={{ margin: 0, fontSize: "0.875rem", fontWeight: 700, color: "#374151" }}>
          🗣️ {title ?? "Language Distribution"}
        </h3>
        <div style={{ display: "flex", gap: "0.4rem" }}>
          {(["count", "wer"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              aria-pressed={view === v}
              style={{
                padding: "0.25rem 0.65rem",
                fontSize: "0.72rem",
                fontWeight: 600,
                borderRadius: "9999px",
                border: `1px solid ${view === v ? "#6366f1" : "#d1d5db"}`,
                background: view === v ? "#6366f1" : "#fff",
                color: view === v ? "#fff" : "#6b7280",
                cursor: "pointer",
              }}
            >
              {v === "count" ? "📊 Recordings" : "📉 WER by Age"}
            </button>
          ))}
        </div>
      </div>

      {view === "count" ? (
        <>
          {/* Horizontal count bars */}
          <div style={{ height: Math.max(120, languages.length * 36) }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={countData}
                layout="vertical"
                margin={{ left: 8, right: 40, top: 4, bottom: 4 }}
              >
                <XAxis type="number" tick={{ fontSize: 10 }} />
                <YAxis type="category" dataKey="language" tick={{ fontSize: 11 }} width={90} />
                <Tooltip formatter={(v) => [`${v} recordings`, "Count"]} />
                <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                  <LabelList dataKey="count" position="right" style={{ fontSize: 10, fill: "#6b7280" }} />
                  {countData.map((d) => (
                    <Cell key={d.language} fill={d.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Language pill summary */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem", marginTop: "0.5rem" }}>
            {languages.map((l, i) => (
              <span
                key={l.language}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.3rem",
                  padding: "0.2rem 0.55rem",
                  borderRadius: "9999px",
                  fontSize: "0.7rem",
                  fontWeight: 600,
                  background: `${LANG_COLORS[i % LANG_COLORS.length]}18`,
                  border: `1px solid ${LANG_COLORS[i % LANG_COLORS.length]}55`,
                  color: LANG_COLORS[i % LANG_COLORS.length],
                }}
              >
                {l.language}
                <span style={{ fontWeight: 400, color: "#6b7280" }}>{l.recording_count}</span>
                {l.wer_pct !== null && (
                  <span style={{ fontWeight: 700 }}>{l.wer_pct.toFixed(0)}%</span>
                )}
              </span>
            ))}
          </div>
        </>
      ) : (
        /* WER by age group */
        <div style={{ height: Math.max(150, languages.length * 30 + 60) }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={werData} margin={{ left: 8, right: 16, top: 4, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
              <XAxis dataKey="language" tick={{ fontSize: 10 }} />
              <YAxis tickFormatter={(v) => `${v}%`} tick={{ fontSize: 10 }} domain={[0, "auto"]} />
              <Tooltip formatter={(v) => [`${(v as number).toFixed(1)}%`, "WER"]} />
              <Legend wrapperStyle={{ fontSize: "0.72rem" }} />
              {AGE_GROUPS.map((ag) => (
                <Bar
                  key={ag}
                  dataKey={ag}
                  name={ag}
                  fill={AGE_COLORS[ag]}
                  radius={[2, 2, 0, 0]}
                  opacity={selectedAgeGroup && selectedAgeGroup !== ag ? 0.3 : 1}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Age breakdown table toggle */}
      <button
        onClick={() => setExpandAge((v) => !v)}
        style={{
          marginTop: "0.75rem",
          fontSize: "0.72rem",
          color: "#6366f1",
          background: "none",
          border: "none",
          cursor: "pointer",
          fontWeight: 600,
          padding: 0,
        }}
      >
        {expandAge ? "▲ Hide" : "▼ Show"} age × language table
      </button>

      {expandAge && (
        <div style={{ overflowX: "auto", marginTop: "0.5rem" }}>
          <table style={{ borderCollapse: "collapse", fontSize: "0.72rem", width: "100%" }}>
            <thead>
              <tr style={{ background: "#f9fafb" }}>
                <th style={{ padding: "0.4rem 0.6rem", textAlign: "left", color: "#6b7280", fontWeight: 600, borderBottom: "1px solid #e5e7eb" }}>Language</th>
                {AGE_GROUPS.map((ag) => (
                  <th key={ag} colSpan={2} style={{ padding: "0.4rem 0.6rem", textAlign: "center", color: AGE_COLORS[ag], fontWeight: 700, borderBottom: "1px solid #e5e7eb" }}>
                    {ag}
                  </th>
                ))}
              </tr>
              <tr style={{ background: "#f9fafb" }}>
                <th style={{ borderBottom: "2px solid #e5e7eb" }} />
                {AGE_GROUPS.flatMap((ag) => [
                  <th key={`${ag}-k`} style={{ padding: "0.25rem 0.4rem", textAlign: "center", color: "#9ca3af", fontWeight: 500, borderBottom: "2px solid #e5e7eb", fontSize: "0.65rem" }}>k</th>,
                  <th key={`${ag}-w`} style={{ padding: "0.25rem 0.4rem", textAlign: "center", color: "#9ca3af", fontWeight: 500, borderBottom: "2px solid #e5e7eb", fontSize: "0.65rem" }}>WER</th>,
                ])}
              </tr>
            </thead>
            <tbody>
              {ageTableData.map(({ language, ages }, ri) => (
                <tr key={language} style={{ background: ri % 2 === 0 ? "#fff" : "#f9fafb" }}>
                  <td style={{ padding: "0.35rem 0.6rem", fontWeight: 600, color: "#374151", borderBottom: "1px solid #f3f4f6" }}>{language}</td>
                  {ages.flatMap(({ ag, count, wer }) => [
                    <td key={`${ag}-k`} style={{ padding: "0.35rem 0.4rem", textAlign: "center", color: count === 0 ? "#d1d5db" : "#374151", borderBottom: "1px solid #f3f4f6" }}>
                      {count === 0 ? "—" : count}
                    </td>,
                    <td key={`${ag}-w`} style={{ padding: "0.35rem 0.4rem", textAlign: "center", color: wer === null ? "#d1d5db" : wer >= 25 ? "#e11d48" : "#059669", fontWeight: wer !== null ? 700 : 400, borderBottom: "1px solid #f3f4f6" }}>
                      {wer === null ? "—" : `${wer.toFixed(1)}%`}
                    </td>,
                  ])}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
