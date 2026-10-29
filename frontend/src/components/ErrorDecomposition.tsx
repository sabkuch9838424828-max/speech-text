import type { CoverageCell } from "../types";
import { EDIT_COLORS } from "../utils/wer";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  Legend,
} from "recharts";

interface ErrorDecompositionProps {
  cell: CoverageCell;
}

function insight(subs: number, dels: number, ins: number): string {
  const total = subs + dels + ins;
  if (total === 0) return "No errors detected in this cohort.";
  const maxType = subs >= dels && subs >= ins ? "substitutions" : dels >= ins ? "deletions" : "insertions";
  if (maxType === "substitutions") return "💡 Substitutions dominate — likely phonetic or dialect differences between speaker and model.";
  if (maxType === "deletions") return "💡 Deletions dominate — model may be missing speech due to volume or speed.";
  return "💡 Insertions dominate — background noise or false positives from the model.";
}

export function ErrorDecomposition({ cell }: ErrorDecompositionProps) {
  const { substitutions: S, deletions: D, insertions: I } = cell;
  const total = S + D + I;

  if (total === 0) {
    return (
      <div style={{ padding: "1.5rem", color: "#9ca3af", textAlign: "center", fontSize: "0.85rem" }}>
        No edit errors for this cell.
      </div>
    );
  }

  const pct = (n: number) => ((n / total) * 100).toFixed(1);

  const barData = [
    { name: "S", value: S, pct: Number(pct(S)), color: EDIT_COLORS.substitutions, label: "Substitutions" },
    { name: "D", value: D, pct: Number(pct(D)), color: EDIT_COLORS.deletions, label: "Deletions" },
    { name: "I", value: I, pct: Number(pct(I)), color: EDIT_COLORS.insertions, label: "Insertions" },
  ];

  return (
    <div>
      <h3 style={{ margin: "0 0 0.75rem", fontSize: "0.875rem", fontWeight: 700, color: "#374151" }}>
        🔬 Error Decomposition
      </h3>
      <p style={{ margin: "0 0 0.75rem", fontSize: "0.75rem", color: "#6b7280" }}>
        {cell.district} · {cell.gender} · {cell.age_group}
      </p>

      {/* Stacked summary row */}
      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.75rem" }}>
        {barData.map(({ label, value, pct: p, color }) => (
          <div
            key={label}
            style={{
              flex: 1,
              background: `${color}18`,
              border: `1px solid ${color}44`,
              borderRadius: "0.5rem",
              padding: "0.4rem 0.5rem",
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: "1rem", fontWeight: 800, color }}>{value}</div>
            <div style={{ fontSize: "0.62rem", color: "#9ca3af" }}>{label}</div>
            <div style={{ fontSize: "0.7rem", color, fontWeight: 600 }}>{p}%</div>
          </div>
        ))}
      </div>

      {/* Bar chart */}
      <div style={{ height: 120 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={barData} layout="vertical" margin={{ left: 8, right: 16, top: 4, bottom: 4 }}>
            <XAxis type="number" domain={[0, total]} tick={{ fontSize: 10 }} />
            <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fontWeight: 600 }} width={20} />
            <Tooltip
              formatter={(value, name, props) => [
                `${value} (${props.payload.pct}%)`,
                props.payload.label,
              ]}
            />
            <Bar dataKey="value" radius={[0, 4, 4, 0]}>
              {barData.map((entry) => (
                <Cell key={entry.name} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Insight */}
      <div
        style={{
          marginTop: "0.75rem",
          background: "#f0f9ff",
          border: "1px solid #bae6fd",
          borderRadius: "0.5rem",
          padding: "0.5rem 0.75rem",
          fontSize: "0.75rem",
          color: "#0369a1",
          lineHeight: 1.6,
        }}
      >
        {insight(S, D, I)}
      </div>

      <p style={{ marginTop: "0.5rem", fontSize: "0.68rem", color: "#9ca3af" }}>
        ⚠ Demographic differences alone do not explain WER patterns. Consult domain experts.
      </p>
    </div>
  );
}
