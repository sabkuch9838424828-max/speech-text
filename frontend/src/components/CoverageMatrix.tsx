import type { CoverageMatrix as CoverageMatrixType } from "../types";

interface CoverageMatrixProps {
  data: CoverageMatrixType;
  onCellClick?: (district: string, gender: string, ageGroup: string) => void;
}

const STATUS_BG: Record<string, string> = {
  no_data: "#f3f4f6",
  insufficient: "#fef9c3",
  ok: "#dcfce7",
};

const STATUS_TEXT: Record<string, string> = {
  no_data: "#9ca3af",
  insufficient: "#ca8a04",
  ok: "#16a34a",
};

const STATUS_LABELS: Record<string, string> = {
  no_data: "No data",
  insufficient: "Insufficient",
  ok: "OK",
};

export function CoverageMatrix({ data, onCellClick }: CoverageMatrixProps) {
  const { cells, districts, genders, age_groups } = data;

  // Build lookup map
  const cellMap = new Map<string, { status: string; recording_count: number }>();
  cells.forEach((c) => {
    cellMap.set(`${c.district}|${c.gender}|${c.age_group}`, c);
  });

  const getCell = (d: string, g: string, a: string) =>
    cellMap.get(`${d}|${g}|${a}`) ?? { status: "no_data", recording_count: 0 };

  return (
    <div
      role="table"
      aria-label="Evidence coverage matrix: district by gender and age group"
      style={{ overflowX: "auto" }}
    >
      {/* Legend */}
      <div style={{ display: "flex", gap: "1rem", marginBottom: "0.75rem", flexWrap: "wrap" }}>
        {Object.entries(STATUS_LABELS).map(([s, label]) => (
          <div key={s} style={{ display: "flex", alignItems: "center", gap: "0.35rem", fontSize: "0.78rem" }}>
            <div style={{ width: 12, height: 12, borderRadius: 3, background: STATUS_BG[s] as string, border: "1px solid #e5e7eb" }} />
            <span style={{ color: "#6b7280" }}>{label}</span>
          </div>
        ))}
      </div>

      <table style={{ borderCollapse: "collapse", fontSize: "0.78rem", minWidth: "600px" }}>
        <thead>
          <tr>
            <th
              scope="col"
              style={{ padding: "0.5rem 0.75rem", textAlign: "left", color: "#6b7280", fontWeight: 600, borderBottom: "2px solid #e5e7eb" }}
            >
              District
            </th>
            {genders.map((g) =>
              age_groups.map((a) => (
                <th
                  key={`${g}-${a}`}
                  scope="col"
                  style={{
                    padding: "0.3rem 0.5rem",
                    textAlign: "center",
                    color: "#6b7280",
                    fontWeight: 500,
                    borderBottom: "2px solid #e5e7eb",
                    minWidth: "70px",
                  }}
                >
                  <div style={{ fontWeight: 700, textTransform: "capitalize" }}>{g}</div>
                  <div style={{ color: "#9ca3af", fontSize: "0.72rem" }}>{a}</div>
                </th>
              ))
            )}
          </tr>
        </thead>
        <tbody>
          {districts.map((district, di) => (
            <tr
              key={district}
              style={{ background: di % 2 === 0 ? "#fff" : "#f9fafb" }}
            >
              <th
                scope="row"
                style={{ padding: "0.5rem 0.75rem", textAlign: "left", fontWeight: 600, color: "#374151", whiteSpace: "nowrap" }}
              >
                {district}
              </th>
              {genders.map((gender) =>
                age_groups.map((age_group) => {
                  const cell = getCell(district, gender, age_group);
                  return (
                    <td
                      key={`${gender}-${age_group}`}
                      onClick={() => onCellClick?.(district, gender, age_group)}
                      role={onCellClick ? "button" : undefined}
                      tabIndex={onCellClick ? 0 : undefined}
                      onKeyDown={onCellClick ? (e) => e.key === "Enter" && onCellClick(district, gender, age_group) : undefined}
                      aria-label={`${district}, ${gender}, ${age_group}: ${cell.status}, ${cell.recording_count} recordings`}
                      style={{
                        padding: "0.4rem 0.5rem",
                        textAlign: "center",
                        background: STATUS_BG[cell.status] as string,
                        color: STATUS_TEXT[cell.status] as string,
                        cursor: onCellClick ? "pointer" : "default",
                        border: "1px solid #e5e7eb",
                        transition: "opacity 0.15s",
                      }}
                    >
                      <div style={{ fontWeight: 700, fontSize: "0.85rem" }}>
                        {cell.recording_count}
                      </div>
                      <div style={{ fontSize: "0.65rem" }}>
                        {STATUS_LABELS[cell.status]}
                      </div>
                    </td>
                  );
                })
              )}
            </tr>
          ))}
        </tbody>
      </table>
      <p style={{ marginTop: "0.5rem", fontSize: "0.72rem", color: "#9ca3af" }}>
        Numbers show recording count per cell. Cells with 0 have no data — they are NOT 0% WER.
      </p>
    </div>
  );
}
