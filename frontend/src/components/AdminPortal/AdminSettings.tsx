import { useEffect, useState } from "react";
import { api } from "../../api/client";
import type { Thresholds } from "../../types";

interface AdminSettingsProps {
  thresholds: Thresholds;
  onThresholdsChange: (newThresholds: Thresholds) => void;
  dataTier: "demo" | "community" | "combined";
  onDataTierChange: (tier: "demo" | "community" | "combined") => void;
}

export function AdminSettings({
  thresholds,
  onThresholdsChange,
  dataTier,
  onDataTierChange,
}: AdminSettingsProps) {
  const [healthStatus, setHealthStatus] = useState<{ status: string; data_label: string; warning: string } | null>(null);
  const [minRecs, setMinRecs] = useState(thresholds.min_recordings);
  const [minWords, setMinWords] = useState(thresholds.min_reference_words);
  const [highWer, setHighWer] = useState(thresholds.high_wer_threshold);
  const [savedMsg, setSavedMsg] = useState(false);

  useEffect(() => {
    api.health().then((h) => setHealthStatus(h)).catch(() => null);
  }, []);

  const handleSaveThresholds = (e: React.FormEvent) => {
    e.preventDefault();
    onThresholdsChange({
      min_recordings: minRecs,
      min_reference_words: minWords,
      high_wer_threshold: highWer,
    });
    setSavedMsg(true);
    setTimeout(() => setSavedMsg(false), 3000);
  };

  return (
    <div style={{ maxWidth: "860px", margin: "0 auto" }}>
      {/* Title */}
      <div style={{ marginBottom: "1.5rem" }}>
        <h1 style={{ fontSize: "1.35rem", fontWeight: 800, color: "#1F2937", margin: "0 0 0.35rem" }}>
          ⚙️ Administrative System Configuration
        </h1>
        <p style={{ fontSize: "0.85rem", color: "#64748B", margin: 0 }}>
          Manage global speech evaluation thresholds, active benchmark tiers, and system diagnostics.
        </p>
      </div>

      {savedMsg && (
        <div
          role="status"
          style={{
            background: "#ECFDF5",
            border: "1px solid #A7F3D0",
            color: "#065F46",
            padding: "0.75rem 1rem",
            borderRadius: "8px",
            fontSize: "0.82rem",
            marginBottom: "1rem",
          }}
        >
          ✓ System threshold policies successfully applied across all analytical views.
        </div>
      )}

      {/* Threshold Policies Form */}
      <div className="bl-card" style={{ padding: "1.75rem", marginBottom: "1.5rem" }}>
        <h2 style={{ fontSize: "1.1rem", fontWeight: 700, color: "#1F2937", margin: "0 0 0.35rem" }}>
          Benchmark Evaluation Thresholds
        </h2>
        <p style={{ fontSize: "0.82rem", color: "#64748B", margin: "0 0 1.25rem" }}>
          Adjust the statistical rigor parameters used to classify cohorts as Evaluated, Insufficient Evidence, or High WER alert.
        </p>

        <form onSubmit={handleSaveThresholds}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "1rem", marginBottom: "1.25rem" }}>
            <div>
              <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 600, color: "#374151", marginBottom: "0.35rem" }}>
                Min Recordings per Cell
              </label>
              <input
                type="number"
                min={1}
                max={100}
                value={minRecs}
                onChange={(e) => setMinRecs(Number(e.target.value))}
                style={{ width: "100%", boxSizing: "border-box" }}
              />
              <span style={{ fontSize: "0.72rem", color: "#64748B", marginTop: "0.2rem", display: "block" }}>
                Default: 5 recordings
              </span>
            </div>

            <div>
              <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 600, color: "#374151", marginBottom: "0.35rem" }}>
                Min Reference Words
              </label>
              <input
                type="number"
                min={5}
                max={500}
                value={minWords}
                onChange={(e) => setMinWords(Number(e.target.value))}
                style={{ width: "100%", boxSizing: "border-box" }}
              />
              <span style={{ fontSize: "0.72rem", color: "#64748B", marginTop: "0.2rem", display: "block" }}>
                Default: 30 words
              </span>
            </div>

            <div>
              <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 600, color: "#374151", marginBottom: "0.35rem" }}>
                High WER Alert Threshold (%)
              </label>
              <input
                type="number"
                min={1}
                max={100}
                step={0.5}
                value={highWer}
                onChange={(e) => setHighWer(Number(e.target.value))}
                style={{ width: "100%", boxSizing: "border-box" }}
              />
              <span style={{ fontSize: "0.72rem", color: "#64748B", marginTop: "0.2rem", display: "block" }}>
                Default: 30.0%
              </span>
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <button
              type="submit"
              style={{
                padding: "0.6rem 1.25rem",
                background: "#2563EB",
                color: "#FFFFFF",
                border: "none",
                borderRadius: "8px",
                fontWeight: 700,
                fontSize: "0.85rem",
                cursor: "pointer",
              }}
            >
              Update Global Thresholds
            </button>
          </div>
        </form>
      </div>

      {/* Data Tier Governance */}
      <div className="bl-card" style={{ padding: "1.75rem", marginBottom: "1.5rem" }}>
        <h2 style={{ fontSize: "1.1rem", fontWeight: 700, color: "#1F2937", margin: "0 0 0.35rem" }}>
          Active Data Tier
        </h2>
        <p style={{ fontSize: "0.82rem", color: "#64748B", margin: "0 0 1.25rem" }}>
          Select which evidence layers feed the administrative analytics, coverage matrix, and action planning.
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "1rem" }}>
          <button
            type="button"
            onClick={() => onDataTierChange("demo")}
            style={{
              padding: "1rem",
              borderRadius: "10px",
              border: dataTier === "demo" ? "2px solid #D97706" : "1px solid #E2E8F0",
              background: dataTier === "demo" ? "#FFFBEB" : "#FFFFFF",
              textAlign: "left",
              cursor: "pointer",
            }}
          >
            <div style={{ fontSize: "0.9rem", fontWeight: 700, color: "#92400E" }}>
              Synthetic Baseline
            </div>
            <div style={{ fontSize: "0.75rem", color: "#78350F", marginTop: "0.25rem" }}>
              Illustrative seed data for competition demo methodology
            </div>
          </button>

          <button
            type="button"
            onClick={() => onDataTierChange("community")}
            style={{
              padding: "1rem",
              borderRadius: "10px",
              border: dataTier === "community" ? "2px solid #059669" : "1px solid #E2E8F0",
              background: dataTier === "community" ? "#ECFDF5" : "#FFFFFF",
              textAlign: "left",
              cursor: "pointer",
            }}
          >
            <div style={{ fontSize: "0.9rem", fontWeight: 700, color: "#065F46" }}>
              Verified Community
            </div>
            <div style={{ fontSize: "0.75rem", color: "#047857", marginTop: "0.25rem" }}>
              Human-verified live community voice inputs only
            </div>
          </button>

          <button
            type="button"
            onClick={() => onDataTierChange("combined")}
            style={{
              padding: "1rem",
              borderRadius: "10px",
              border: dataTier === "combined" ? "2px solid #2563EB" : "1px solid #E2E8F0",
              background: dataTier === "combined" ? "#EFF6FF" : "#FFFFFF",
              textAlign: "left",
              cursor: "pointer",
            }}
          >
            <div style={{ fontSize: "0.9rem", fontWeight: 700, color: "#1E40AF" }}>
              Combined View
            </div>
            <div style={{ fontSize: "0.75rem", color: "#2563EB", marginTop: "0.25rem" }}>
              Joint overlay of baseline seeds and community records
            </div>
          </button>
        </div>
      </div>

      {/* Backend Health Diagnostics */}
      <div className="bl-card" style={{ padding: "1.75rem" }}>
        <h2 style={{ fontSize: "1.1rem", fontWeight: 700, color: "#1F2937", margin: "0 0 0.35rem" }}>
          System Health Diagnostics
        </h2>
        <p style={{ fontSize: "0.82rem", color: "#64748B", margin: "0 0 1rem" }}>
          Live backend heartbeat probe response
        </p>

        {healthStatus ? (
          <div style={{ background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: "8px", padding: "1rem", fontSize: "0.85rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.4rem" }}>
              <span className="bl-badge bl-badge-success">Status: {healthStatus.status.toUpperCase()}</span>
              <span className="bl-badge bl-badge-neutral">Data Label: {healthStatus.data_label}</span>
            </div>
            <div style={{ color: "#64748B", fontSize: "0.78rem" }}>
              Notice: {healthStatus.warning}
            </div>
          </div>
        ) : (
          <div style={{ color: "#94A3B8", fontSize: "0.85rem" }}>Checking backend status…</div>
        )}
      </div>
    </div>
  );
}
