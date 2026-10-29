import type { WerResult } from "../types";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { STATUS_COLORS } from "../utils/wer";

interface WerChartProps {
  data: WerResult[];
  highWerThreshold?: number;
}

interface TooltipPayload {
  payload?: WerResult;
}

function CustomTooltip({ active, payload }: { active?: boolean; payload?: TooltipPayload[] }) {
  if (!active || !payload?.length || !payload[0].payload) return null;
  const d = payload[0].payload;
  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid #e5e7eb",
        borderRadius: "0.5rem",
        padding: "0.75rem 1rem",
        fontSize: "0.82rem",
        boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
      }}
    >
      <p style={{ margin: "0 0 0.4rem", fontWeight: 700 }}>{d.district}</p>
      {d.wer_pct !== null ? (
        <p style={{ margin: "0 0 0.25rem", color: STATUS_COLORS[d.status] }}>
          WER: {d.wer_pct.toFixed(1)}%
        </p>
      ) : (
        <p style={{ margin: "0 0 0.25rem", color: "#9ca3af" }}>WER: — ({d.status})</p>
      )}
      <p style={{ margin: 0, color: "#6b7280" }}>
        {d.recording_count} recordings · {d.reference_word_count} ref words
      </p>
    </div>
  );
}

export function WerChart({ data, highWerThreshold = 30 }: WerChartProps) {
  const chartData = data.map((d) => ({
    ...d,
    wer_value: d.wer_pct ?? 0,
    has_data: d.wer_pct !== null,
  }));

  if (chartData.length === 0) {
    return (
      <div style={{ padding: "2rem", textAlign: "center", color: "#9ca3af" }}>
        No districts to display.
      </div>
    );
  }

  return (
    <div role="img" aria-label="Bar chart showing WER percentage by district">
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 40 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
          <XAxis
            dataKey="district"
            tick={{ fontSize: 12, fill: "#6b7280" }}
            angle={-30}
            textAnchor="end"
            height={60}
          />
          <YAxis
            unit="%"
            tick={{ fontSize: 12, fill: "#6b7280" }}
            domain={[0, "auto"]}
            label={{ value: "WER %", angle: -90, position: "insideLeft", fill: "#6b7280", fontSize: 12 }}
          />
          <Tooltip content={<CustomTooltip />} />
          <ReferenceLine
            y={highWerThreshold}
            stroke="#f97316"
            strokeDasharray="4 4"
            label={{ value: `${highWerThreshold}% threshold`, fill: "#f97316", fontSize: 11 }}
          />
          <Bar dataKey="wer_value" radius={[4, 4, 0, 0]} maxBarSize={60}>
            {chartData.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={entry.has_data ? STATUS_COLORS[entry.status] : "#e5e7eb"}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <p style={{ textAlign: "center", fontSize: "0.72rem", color: "#9ca3af", margin: "0.25rem 0 0" }}>
        Grey bars = no WER score (no data, insufficient, or cannot calculate). Height is 0, not 0% WER.
      </p>
    </div>
  );
}
