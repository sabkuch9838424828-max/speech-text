import { useEffect, useRef, useState } from "react";
import type { Thresholds } from "../types";

interface ThresholdBarProps {
  value: Thresholds;
  onChange: (t: Thresholds) => void;
}

interface SliderConfig {
  key: keyof Thresholds;
  label: string;
  symbol: string;
  min: number;
  max: number;
  step: number;
  format: (v: number) => string;
}

const SLIDERS: SliderConfig[] = [
  {
    key: "min_recordings",
    label: "Min Samples",
    symbol: "k",
    min: 1,
    max: 30,
    step: 1,
    format: (v) => `${v}`,
  },
  {
    key: "min_reference_words",
    label: "Min Words",
    symbol: "W",
    min: 10,
    max: 200,
    step: 10,
    format: (v) => `${v}`,
  },
  {
    key: "high_wer_threshold",
    label: "WER Alert",
    symbol: "τ",
    min: 10,
    max: 50,
    step: 1,
    format: (v) => `${v}%`,
  },
];

export function ThresholdBar({ value, onChange }: ThresholdBarProps) {
  const [local, setLocal] = useState<Thresholds>(value);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync if parent resets
  useEffect(() => {
    setLocal(value);
  }, [value]);

  const handleChange = (key: keyof Thresholds, raw: number) => {
    const next = { ...local, [key]: raw };
    setLocal(next);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => onChange(next), 300);
  };

  return (
    <div
      style={{
        background: "#FFFFFF",
        borderBottom: "1px solid #E2E8F0",
        padding: "0.75rem 1.5rem",
        display: "flex",
        gap: "2rem",
        flexWrap: "wrap",
        alignItems: "center",
      }}
    >
      <span
        style={{
          color: "#1F2937",
          fontSize: "0.75rem",
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          whiteSpace: "nowrap",
          display: "flex",
          alignItems: "center",
          gap: "0.4rem",
        }}
      >
        <span>⚙️</span> Policy Thresholds
      </span>
      {SLIDERS.map((s) => {
        const v = local[s.key];
        const pct = ((v - s.min) / (s.max - s.min)) * 100;
        return (
          <div
            key={s.key}
            style={{ display: "flex", alignItems: "center", gap: "0.6rem", flex: "1 1 200px" }}
          >
            <label
              htmlFor={`slider-${s.key}`}
              style={{
                color: "#475569",
                fontSize: "0.78rem",
                fontWeight: 600,
                whiteSpace: "nowrap",
                minWidth: "70px",
              }}
            >
              {s.label} ({s.symbol}):
            </label>
            <input
              id={`slider-${s.key}`}
              type="range"
              min={s.min}
              max={s.max}
              step={s.step}
              value={v}
              onChange={(e) => handleChange(s.key, Number(e.target.value))}
              aria-label={`${s.label} threshold: ${s.format(v)}`}
              style={{
                flex: 1,
                accentColor: "#2563EB",
                cursor: "pointer",
              }}
            />
            <span
              style={{
                color: "#1E40AF",
                fontSize: "0.82rem",
                fontWeight: 700,
                minWidth: "36px",
                textAlign: "right",
                background: "#EFF6FF",
                border: "1px solid #BFDBFE",
                borderRadius: "0.35rem",
                padding: "0.1rem 0.45rem",
              }}
            >
              {s.format(v)}
            </span>
            <span style={{ display: "none" }}>{pct}</span>
          </div>
        );
      })}
    </div>
  );
}
