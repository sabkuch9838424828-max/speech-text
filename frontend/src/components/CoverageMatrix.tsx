import { useState } from "react";
import type { CoverageMatrix as CoverageMatrixType, CoverageCell } from "../types";
import { STATUS_STYLE } from "../utils/wer";

interface CoverageMatrixProps {
  data: CoverageMatrixType;
  onCellSelect?: (district: string, gender: string, ageGroup: string) => void;
  onWerClick?: (cell: CoverageCell) => void;
  selectedCell?: { district: string; gender: string; age_group: string } | null;
}

export function CoverageMatrix({
  data,
  onCellSelect,
  onWerClick,
  selectedCell,
}: CoverageMatrixProps) {
  const { cells, districts, genders, age_groups } = data;
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);

  // Build lookup map
  const cellMap = new Map<string, CoverageCell>();
  cells.forEach((c) => {
    cellMap.set(`${c.district}|${c.gender}|${c.age_group}`, c);
  });

  const getCell = (d: string, g: string, a: string): CoverageCell =>
    cellMap.get(`${d}|${g}|${a}`) ?? {
      district: d,
      gender: g,
      age_group: a,
      status: "no_data",
      recording_count: 0,
      reference_word_count: 0,
      wer_pct: null,
      substitutions: 0,
      deletions: 0,
      insertions: 0,
    };

  const columns = genders.flatMap((g) => age_groups.map((a) => ({ g, a })));

  return (
    <div>
      {/* Legend */}
      <div style={{ display: "flex", gap: "0.75rem", marginBottom: "0.75rem", flexWrap: "wrap" }}>
        {(["no_data", "insufficient", "cannot_calculate", "high_wer", "ok"] as const).map(
          (status) => {
            const s = STATUS_STYLE[status];
            return (
              <div key={status} style={{ display: "flex", alignItems: "center", gap: "0.3rem", fontSize: "0.72rem" }}>
                <div
                  style={{
                    width: 12,
                    height: 12,
                    borderRadius: 3,
                    background: s.bg,
                    border: `1px solid ${s.border}`,
                  }}
                />
                <span style={{ color: "#6b7280" }}>
                  {s.emoji} {s.label}
                </span>
              </div>
            );
          }
        )}
        <span style={{ marginLeft: "auto", fontSize: "0.7rem", color: "#9ca3af" }}>
          * Insufficient evidence (below threshold)
        </span>
      </div>

      {/* Table */}
      <div role="table" aria-label="Evidence coverage matrix" style={{ overflowX: "auto" }}>
        <table style={{ borderCollapse: "collapse", fontSize: "0.75rem", minWidth: "700px", width: "100%" }}>
          <thead>
            <tr>
              <th
                scope="col"
                style={{
                  padding: "0.5rem 0.75rem",
                  textAlign: "left",
                  color: "#374151",
                  fontWeight: 700,
                  borderBottom: "2px solid #e5e7eb",
                  background: "#f9fafb",
                  position: "sticky",
                  left: 0,
                  zIndex: 1,
                }}
              >
                District
              </th>
              {columns.map(({ g, a }) => (
                <th
                  key={`${g}-${a}`}
                  scope="col"
                  style={{
                    padding: "0.3rem 0.4rem",
                    textAlign: "center",
                    color: "#6b7280",
                    fontWeight: 500,
                    borderBottom: "2px solid #e5e7eb",
                    minWidth: "80px",
                    background: "#f9fafb",
                  }}
                >
                  <div style={{ fontWeight: 700, textTransform: "capitalize", fontSize: "0.72rem" }}>{g}</div>
                  <div style={{ color: "#9ca3af", fontSize: "0.65rem" }}>{a}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {districts.map((district) => (
              <tr key={district}>
                <th
                  scope="row"
                  style={{
                    padding: "0.4rem 0.75rem",
                    textAlign: "left",
                    fontWeight: 600,
                    color: "#374151",
                    whiteSpace: "nowrap",
                    background: "#f9fafb",
                    position: "sticky",
                    left: 0,
                    borderRight: "1px solid #e5e7eb",
                  }}
                >
                  {district}
                </th>
                {columns.map(({ g: gender, a: age_group }) => {
                  const cell = getCell(district, gender, age_group);
                  const s = STATUS_STYLE[cell.status];
                  const key = `${district}|${gender}|${age_group}`;
                  const isSelected =
                    selectedCell?.district === district &&
                    selectedCell?.gender === gender &&
                    selectedCell?.age_group === age_group;
                  const isHovered = hoveredKey === key;
                  const isInsufficient = cell.status === "insufficient";
                  const hasWer = cell.wer_pct !== null && (cell.status === "ok" || cell.status === "high_wer");

                  return (
                    <td
                      key={key}
                      onClick={() => onCellSelect?.(district, gender, age_group)}
                      onMouseEnter={() => setHoveredKey(key)}
                      onMouseLeave={() => setHoveredKey(null)}
                      role={onCellSelect ? "button" : undefined}
                      tabIndex={onCellSelect ? 0 : undefined}
                      onKeyDown={
                        onCellSelect
                          ? (e) => e.key === "Enter" && onCellSelect(district, gender, age_group)
                          : undefined
                      }
                      aria-label={`${district}, ${gender}, ${age_group}: ${s.label}${hasWer ? `, WER ${cell.wer_pct!.toFixed(1)}%` : ""}, ${cell.recording_count} recordings`}
                      aria-pressed={isSelected}
                      style={{
                        padding: "0.4rem 0.35rem",
                        textAlign: "center",
                        background: isSelected ? `${s.bg}` : s.bg,
                        color: s.text,
                        cursor: onCellSelect ? "pointer" : "default",
                        border: isSelected
                          ? `2px solid ${s.border === "#cbd5e1" ? "#6366f1" : s.border}`
                          : `1px solid ${s.border}`,
                        transition: "opacity 0.15s",
                        opacity: isHovered && !isSelected ? 0.8 : 1,
                        outline: isSelected ? `2px solid ${s.border}` : "none",
                        position: "relative",
                      }}
                    >
                      {cell.status === "no_data" ? (
                        <div style={{ color: "#94a3b8", fontSize: "1rem" }}>—</div>
                      ) : (
                        <>
                          {/* WER or count */}
                          {hasWer ? (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onWerClick?.(cell);
                              }}
                              title="Click to see WER formula"
                              aria-label={`View WER math for ${district} ${gender} ${age_group}`}
                              style={{
                                background: "none",
                                border: "none",
                                padding: 0,
                                cursor: "pointer",
                                color: s.text,
                                fontWeight: 700,
                                fontSize: "0.82rem",
                                textDecoration: "underline dotted",
                              }}
                            >
                              {s.emoji} {cell.wer_pct!.toFixed(1)}%{isInsufficient ? "*" : ""}
                            </button>
                          ) : (
                            <div style={{ fontWeight: 700, fontSize: "0.8rem" }}>
                              {s.emoji} {cell.status === "insufficient" ? `${cell.recording_count}*` : cell.recording_count}
                            </div>
                          )}
                          {/* Sample count */}
                          <div style={{ fontSize: "0.62rem", color: s.text, opacity: 0.75 }}>
                            k={cell.recording_count}
                          </div>
                        </>
                      )}

                      {/* Hover tooltip */}
                      {isHovered && cell.status !== "no_data" && (
                        <div
                          role="tooltip"
                          style={{
                            position: "absolute",
                            zIndex: 10,
                            bottom: "calc(100% + 4px)",
                            left: "50%",
                            transform: "translateX(-50%)",
                            background: "#1f2937",
                            color: "#f9fafb",
                            borderRadius: "0.5rem",
                            padding: "0.5rem 0.75rem",
                            fontSize: "0.7rem",
                            whiteSpace: "nowrap",
                            pointerEvents: "none",
                            boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
                          }}
                        >
                          <div>Words: {cell.reference_word_count.toLocaleString()}</div>
                          {hasWer && (
                            <>
                              <div>S: {cell.substitutions} D: {cell.deletions} I: {cell.insertions}</div>
                            </>
                          )}
                          <div style={{ color: "#9ca3af", marginTop: "0.2rem" }}>{s.label}</div>
                        </div>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p style={{ marginTop: "0.5rem", fontSize: "0.7rem", color: "#9ca3af" }}>
        * Insufficient evidence — below minimum threshold. Not a reliable WER estimate.
        Click any cell to inspect. Click WER% to see the aggregate formula.
      </p>
    </div>
  );
}
