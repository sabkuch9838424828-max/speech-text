import type { WerResult } from "../types";
import { STATUS_COLORS } from "../utils/wer";
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

interface WerChartProps {
  data: WerResult[];
  highWerThreshold: number;
  onBarClick?: (district: string) => void;
}

export function WerChart({ data, highWerThreshold, onBarClick }: WerChartProps) {
  const chartData = data
    .filter((r) => r.wer_pct !== null)
    .map((r) => ({
      district: r.district.length > 10 ? r.district.slice(0, 9) + "…" : r.district,
      fullName: r.district,
      wer: r.wer_pct!,
      status: r.status,
    }))
    .sort((a, b) => b.wer - a.wer);

  if (chartData.length === 0) {
    return (
      <div style={{ padding: "2rem", textAlign: "center", color: "#9ca3af", fontSize: "0.85rem" }}>
        No districts with calculable WER to chart.
      </div>
    );
  }

  return (
    <div style={{ height: 220 }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={chartData}
          margin={{ top: 4, right: 16, left: 0, bottom: 4 }}
          onClick={(d) => {
            if (d?.activePayload?.[0] && onBarClick) {
              onBarClick(d.activePayload[0].payload.fullName);
            }
          }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
          <XAxis dataKey="district" tick={{ fontSize: 10, fill: "#6b7280" }} />
          <YAxis
            tickFormatter={(v) => `${v}%`}
            tick={{ fontSize: 10, fill: "#6b7280" }}
            domain={[0, "auto"]}
          />
          <Tooltip
            formatter={(value) => [`${(value as number).toFixed(1)}%`, "WER"]}
            labelFormatter={(label) => {
              const item = chartData.find((d) => d.district === label);
              return item?.fullName ?? label;
            }}
          />
          <ReferenceLine
            y={highWerThreshold}
            stroke="#e11d48"
            strokeDasharray="4 2"
            label={{
              value: `Alert ${highWerThreshold}%`,
              position: "right",
              fontSize: 9,
              fill: "#e11d48",
            }}
          />
          <Bar dataKey="wer" radius={[4, 4, 0, 0]} cursor={onBarClick ? "pointer" : "default"}>
            {chartData.map((entry) => (
              <Cell key={entry.fullName} fill={STATUS_COLORS[entry.status]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
