import React from "react";
import type { LanguageMatrixResponse } from "../types";

interface LanguageHeatmapProps {
  data: LanguageMatrixResponse;
  selectedDistrict?: string;
  selectedAgeGroup?: string;
  onSelectDistrict?: (district: string) => void;
}

export function LanguageHeatmap({
  data,
  selectedDistrict,
  selectedAgeGroup,
  onSelectDistrict,
}: LanguageHeatmapProps) {
  const { cells, districts, languages, age_groups } = data;

  // Filter districts if a specific district is selected (or show all)
  const displayDistricts = selectedDistrict
    ? districts.filter((d) => d === selectedDistrict)
    : districts;

  // Filter ages if selected
  const displayAges = selectedAgeGroup
    ? age_groups.filter((a) => a === selectedAgeGroup)
    : age_groups;

  // Fast cell lookup: district|language|age_group
  const cellMap = new Map<string, { count: number; wer: number | null }>();
  cells.forEach((c) => {
    cellMap.set(`${c.district}|${c.language}|${c.age_group}`, {
      count: c.recording_count,
      wer: c.wer_pct,
    });
  });

  // Calculate language totals to only show relevant languages for current view
  const activeLanguages = languages.filter((lang) => {
    return displayDistricts.some((dist) =>
      displayAges.some((age) => {
        const c = cellMap.get(`${dist}|${lang}|${age}`);
        return c && c.count > 0;
      })
    );
  });

  return (
    <div style={{ overflowX: "auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
        <span style={{ fontSize: "0.75rem", color: "#6b7280" }}>
          Showing <strong>{activeLanguages.length}</strong> active languages across {displayDistricts.length} districts and {displayAges.length} age groups.
        </span>
        <span style={{ fontSize: "0.7rem", color: "#9ca3af" }}>
          Format: <strong>count</strong> · WER% (k=sample size)
        </span>
      </div>

      <table style={{ borderCollapse: "collapse", fontSize: "0.72rem", width: "100%", minWidth: "650px" }}>
        <thead>
          <tr style={{ background: "#f8fafc" }}>
            <th
              style={{
                padding: "0.5rem 0.75rem",
                textAlign: "left",
                color: "#475569",
                fontWeight: 700,
                borderBottom: "2px solid #e2e8f0",
                position: "sticky",
                left: 0,
                background: "#f8fafc",
                zIndex: 2,
              }}
            >
              District / Age
            </th>
            {activeLanguages.map((lang) => (
              <th
                key={lang}
                style={{
                  padding: "0.5rem 0.5rem",
                  textAlign: "center",
                  color: "#334155",
                  fontWeight: 700,
                  borderBottom: "2px solid #e2e8f0",
                  minWidth: "75px",
                }}
              >
                {lang}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {displayDistricts.flatMap((dist) =>
            displayAges.map((age, ageIdx) => {
              const isFirstAge = ageIdx === 0;
              return (
                <tr
                  key={`${dist}-${age}`}
                  style={{
                    background: ageIdx % 2 === 0 ? "#ffffff" : "#fbfcfe",
                    borderBottom: ageIdx === displayAges.length - 1 ? "2px solid #e2e8f0" : "1px solid #f1f5f9",
                  }}
                >
                  <th
                    scope="row"
                    style={{
                      padding: "0.35rem 0.75rem",
                      textAlign: "left",
                      fontWeight: 600,
                      color: "#1e293b",
                      whiteSpace: "nowrap",
                      position: "sticky",
                      left: 0,
                      background: ageIdx % 2 === 0 ? "#ffffff" : "#fbfcfe",
                      borderRight: "1px solid #e2e8f0",
                      zIndex: 1,
                    }}
                  >
                    <span
                      onClick={() => onSelectDistrict?.(dist)}
                      style={{
                        cursor: onSelectDistrict ? "pointer" : "default",
                        color: onSelectDistrict ? "#4f46e5" : "inherit",
                        textDecoration: onSelectDistrict ? "underline" : "none",
                      }}
                    >
                      {dist}
                    </span>{" "}
                    <span style={{ fontSize: "0.68rem", color: "#64748b", fontWeight: 400 }}>({age})</span>
                  </th>

                  {activeLanguages.map((lang) => {
                    const c = cellMap.get(`${dist}|${lang}|${age}`);
                    const count = c?.count ?? 0;
                    const wer = c?.wer ?? null;

                    let bg = "#ffffff";
                    let color = "#94a3b8";

                    if (count > 0) {
                      if (wer === null) {
                        bg = "#f3f4f6";
                        color = "#374151";
                      } else if (wer < 15) {
                        bg = "#ecfdf5";
                        color = "#047857";
                      } else if (wer < 25) {
                        bg = "#f0fdf4";
                        color = "#15803d";
                      } else if (wer < 35) {
                        bg = "#fffbeb";
                        color = "#b45309";
                      } else {
                        bg = "#fff1f2";
                        color = "#b91c1c";
                      }
                    }

                    return (
                      <td
                        key={`${dist}-${lang}-${age}`}
                        style={{
                          padding: "0.35rem 0.4rem",
                          textAlign: "center",
                          background: bg,
                          color: color,
                          border: "1px solid #f1f5f9",
                        }}
                      >
                        {count === 0 ? (
                          <span style={{ color: "#cbd5e1" }}>—</span>
                        ) : (
                          <div>
                            <span style={{ fontWeight: 700 }}>
                              {wer !== null ? `${wer.toFixed(1)}%` : "N/A"}
                            </span>
                            <div style={{ fontSize: "0.65rem", opacity: 0.8 }}>k={count}</div>
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
