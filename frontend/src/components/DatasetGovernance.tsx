import { useState, useEffect } from "react";
import { api } from "../api/client";
import type { DatasetVersion, ModelEvaluation } from "../types";

export function DatasetGovernance({ onDatasetChanged }: { onDatasetChanged?: () => void }) {
  const [activeSubTab, setActiveSubTab] = useState<"datasets" | "evaluations">("datasets");

  // Datasets state
  const [datasets, setDatasets] = useState<DatasetVersion[]>([]);
  const [loadingDatasets, setLoadingDatasets] = useState(true);
  const [selectedDataset, setSelectedDataset] = useState<DatasetVersion | null>(null);

  // Publish Dialog
  const [showPublishModal, setShowPublishModal] = useState(false);
  const [pubVersion, setPubVersion] = useState("v1.0.1");
  const [pubTitle, setPubTitle] = useState("Indic Community Verified Benchmark");
  const [pubDescription, setPubDescription] = useState("Curated and verified community speech dataset across diverse Indian dialects.");
  const [pubPublisher, setPubPublisher] = useState("Data-Governance-Lead");
  const [pubSetActive, setPubSetActive] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);

  // Evaluations state
  const [evaluations, setEvaluations] = useState<ModelEvaluation[]>([]);
  const [loadingEvals, setLoadingEvals] = useState(false);

  // Run Evaluation Form
  const [evalModelName, setEvalModelName] = useState("IndicConformer-v2");
  const [evalModelVersion, setEvalModelVersion] = useState("2.0-rc2");
  const [evalSplit, setEvalSplit] = useState("test");
  const [evalBaselineWer, setEvalBaselineWer] = useState(25.0);
  const [runningEval, setRunningEval] = useState(false);
  const [evalError, setEvalError] = useState<string | null>(null);
  const [evalSuccess, setEvalSuccess] = useState<string | null>(null);

  const fetchDatasets = () => {
    setLoadingDatasets(true);
    api.datasets()
      .then((res) => {
        setDatasets(res.datasets);
        if (res.datasets.length > 0 && !selectedDataset) {
          setSelectedDataset(res.datasets[0]);
        }
      })
      .catch(() => setDatasets([]))
      .finally(() => setLoadingDatasets(false));
  };

  const fetchEvaluations = () => {
    setLoadingEvals(true);
    api.evaluations()
      .then((res) => setEvaluations(res.evaluations))
      .catch(() => setEvaluations([]))
      .finally(() => setLoadingEvals(false));
  };

  useEffect(() => {
    fetchDatasets();
    fetchEvaluations();
  }, []);

  const handlePublish = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pubVersion.trim() || !pubTitle.trim() || !pubPublisher.trim()) {
      setPublishError("Version, title, and publisher identity are required.");
      return;
    }

    setPublishing(true);
    setPublishError(null);
    try {
      await api.publishDataset({
        version: pubVersion.trim(),
        title: pubTitle.trim(),
        description: pubDescription.trim(),
        published_by: pubPublisher.trim(),
        set_as_active_benchmark: pubSetActive,
      });

      setShowPublishModal(false);
      fetchDatasets();
      if (onDatasetChanged) onDatasetChanged();
    } catch (err: unknown) {
      setPublishError(err instanceof Error ? err.message : "Publication failed.");
    } finally {
      setPublishing(false);
    }
  };

  const handleRunEvaluation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDataset) {
      setEvalError("Please select an approved dataset version to evaluate.");
      return;
    }

    setRunningEval(true);
    setEvalError(null);
    setEvalSuccess(null);

    try {
      const res = await api.runEvaluation({
        dataset_id: selectedDataset.id,
        candidate_model_name: evalModelName.trim(),
        candidate_model_version: evalModelVersion.trim(),
        split_to_evaluate: evalSplit,
        baseline_wer: Number(evalBaselineWer),
      });

      setEvalSuccess(`Evaluation completed! Overall WER: ${res.overall_wer ?? "—"}% (Delta: ${res.wer_delta ?? "—"}%)`);
      fetchEvaluations();
    } catch (err: unknown) {
      setEvalError(err instanceof Error ? err.message : "Evaluation failed.");
    } finally {
      setRunningEval(false);
    }
  };

  const handlePromote = async (evalId: string) => {
    if (!confirm("Are you sure you want to promote this candidate model to benchmark baseline?")) {
      return;
    }
    try {
      await api.promoteModel(evalId, { promoted_by: pubPublisher });
      fetchEvaluations();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Promotion failed.");
    }
  };

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: "1.5rem" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem", flexWrap: "wrap", gap: "1rem" }}>
        <div>
          <h2 style={{ margin: "0 0 0.35rem", fontSize: "1.5rem", fontWeight: 700, color: "#1e1b4b" }}>
            📦 Dataset Governance & Model Evaluation
          </h2>
          <p style={{ margin: 0, color: "#64748b", fontSize: "0.85rem" }}>
            Controlled publication of human-verified datasets and reproducible candidate model benchmarking.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowPublishModal(true)}
          style={{
            background: "#4f46e5",
            color: "#fff",
            border: "none",
            padding: "0.6rem 1.25rem",
            borderRadius: "0.5rem",
            fontSize: "0.88rem",
            fontWeight: 700,
            cursor: "pointer",
            boxShadow: "0 2px 5px rgba(79,70,229,0.3)",
          }}
        >
          🚀 Publish New Dataset Snapshot
        </button>
      </div>

      {/* Sub-tab navigation */}
      <div style={{ display: "flex", gap: "0.75rem", marginBottom: "1.5rem" }}>
        <button
          type="button"
          onClick={() => setActiveSubTab("datasets")}
          style={{
            padding: "0.6rem 1.25rem",
            borderRadius: "0.5rem",
            border: activeSubTab === "datasets" ? "2px solid #6366f1" : "1px solid #e2e8f0",
            background: activeSubTab === "datasets" ? "#eef2ff" : "#fff",
            color: activeSubTab === "datasets" ? "#4338ca" : "#64748b",
            fontWeight: 700,
            fontSize: "0.9rem",
            cursor: "pointer",
          }}
        >
          📚 Published Dataset Versions ({datasets.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab("evaluations")}
          style={{
            padding: "0.6rem 1.25rem",
            borderRadius: "0.5rem",
            border: activeSubTab === "evaluations" ? "2px solid #6366f1" : "1px solid #e2e8f0",
            background: activeSubTab === "evaluations" ? "#eef2ff" : "#fff",
            color: activeSubTab === "evaluations" ? "#4338ca" : "#64748b",
            fontWeight: 700,
            fontSize: "0.9rem",
            cursor: "pointer",
          }}
        >
          🔬 Candidate Model Evaluations ({evaluations.length})
        </button>
      </div>

      {/* Tab A: Published Datasets */}
      {activeSubTab === "datasets" && (
        <div style={{ display: "grid", gridTemplateColumns: "350px 1fr", gap: "1.5rem" }}>
          {/* Datasets list */}
          <div
            style={{
              background: "#fff",
              border: "1px solid #e2e8f0",
              borderRadius: "0.75rem",
              padding: "0.75rem",
            }}
          >
            <div style={{ fontSize: "0.8rem", fontWeight: 700, color: "#64748b", padding: "0.5rem" }}>
              Frozen Dataset Snapshots
            </div>

            {loadingDatasets ? (
              <div style={{ padding: "2rem", textAlign: "center", color: "#94a3b8" }}>Loading datasets...</div>
            ) : datasets.length === 0 ? (
              <div style={{ padding: "2rem", textAlign: "center", color: "#94a3b8", fontSize: "0.85rem" }}>
                No published dataset snapshots yet. Approve community submissions and click 'Publish New Dataset Snapshot'.
              </div>
            ) : (
              datasets.map((ds) => {
                const isSelected = selectedDataset?.id === ds.id;
                return (
                  <div
                    key={ds.id}
                    onClick={() => setSelectedDataset(ds)}
                    style={{
                      padding: "0.85rem",
                      borderRadius: "0.5rem",
                      marginBottom: "0.5rem",
                      cursor: "pointer",
                      border: isSelected ? "2px solid #6366f1" : "1px solid #f1f5f9",
                      background: isSelected ? "#eef2ff" : "#fff",
                      transition: "all 0.15s ease",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.25rem" }}>
                      <span style={{ fontSize: "0.95rem", fontWeight: 700, color: "#1e1b4b" }}>
                        {ds.version}
                      </span>
                      {ds.is_active_benchmark === 1 && (
                        <span style={{ background: "#dcfce7", color: "#15803d", padding: "0.15rem 0.4rem", borderRadius: "0.25rem", fontSize: "0.68rem", fontWeight: 700 }}>
                          Active Baseline
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: "0.8rem", color: "#475569", marginBottom: "0.35rem" }}>
                      {ds.title}
                    </div>
                    <div style={{ fontSize: "0.72rem", color: "#94a3b8" }}>
                      Records: <strong>{ds.total_records}</strong> · Published: {new Date(ds.published_at).toLocaleDateString()}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Dataset details */}
          {selectedDataset ? (
            <div
              style={{
                background: "#fff",
                border: "1px solid #e2e8f0",
                borderRadius: "0.75rem",
                padding: "1.5rem",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1rem" }}>
                <div>
                  <h3 style={{ margin: "0 0 0.25rem", fontSize: "1.25rem", fontWeight: 700, color: "#1e1b4b" }}>
                    {selectedDataset.title} ({selectedDataset.version})
                  </h3>
                  <div style={{ fontSize: "0.8rem", color: "#64748b" }}>
                    Published by: <strong>{selectedDataset.published_by}</strong> on {new Date(selectedDataset.published_at).toLocaleString()}
                  </div>
                </div>
                {selectedDataset.is_active_benchmark === 1 && (
                  <span style={{ background: "#dcfce7", color: "#166534", padding: "0.35rem 0.75rem", borderRadius: "0.4rem", fontSize: "0.8rem", fontWeight: 700 }}>
                    ⭐ Official Production Baseline
                  </span>
                )}
              </div>

              <p style={{ fontSize: "0.88rem", color: "#334155", lineHeight: 1.5, margin: "0 0 1.25rem" }}>
                {selectedDataset.description}
              </p>

              {/* Splits Grid */}
              <div style={{ marginBottom: "1.5rem" }}>
                <div style={{ fontSize: "0.8rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase", marginBottom: "0.5rem" }}>
                  Reproducible Split Allocations (Leakage-Free)
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.75rem" }}>
                  <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "0.5rem", padding: "0.75rem", textAlign: "center" }}>
                    <div style={{ fontSize: "1.25rem", fontWeight: 800, color: "#4f46e5" }}>
                      {selectedDataset.splits?.train ?? 0}
                    </div>
                    <div style={{ fontSize: "0.75rem", color: "#64748b" }}>Train Split (70%)</div>
                  </div>
                  <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "0.5rem", padding: "0.75rem", textAlign: "center" }}>
                    <div style={{ fontSize: "1.25rem", fontWeight: 800, color: "#0891b2" }}>
                      {selectedDataset.splits?.validation ?? 0}
                    </div>
                    <div style={{ fontSize: "0.75rem", color: "#64748b" }}>Validation Split (15%)</div>
                  </div>
                  <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "0.5rem", padding: "0.75rem", textAlign: "center" }}>
                    <div style={{ fontSize: "1.25rem", fontWeight: 800, color: "#16a34a" }}>
                      {selectedDataset.splits?.test ?? 0}
                    </div>
                    <div style={{ fontSize: "0.75rem", color: "#64748b" }}>Test Split (15%)</div>
                  </div>
                </div>
              </div>

              {/* Language Breakdown */}
              <div>
                <div style={{ fontSize: "0.8rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase", marginBottom: "0.5rem" }}>
                  Language Representation
                </div>
                <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                  {Object.entries(selectedDataset.language_breakdown).map(([lang, count]) => (
                    <span
                      key={lang}
                      style={{
                        background: "#eef2ff",
                        color: "#3730a3",
                        padding: "0.35rem 0.75rem",
                        borderRadius: "0.4rem",
                        fontSize: "0.82rem",
                        fontWeight: 600,
                      }}
                    >
                      {lang}: <strong>{count}</strong>
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div style={{ padding: "3rem", textAlign: "center", color: "#94a3b8" }}>
              Select a dataset snapshot to inspect details.
            </div>
          )}
        </div>
      )}

      {/* Tab B: Candidate Model Evaluations */}
      {activeSubTab === "evaluations" && (
        <div>
          {/* Run Evaluation Box */}
          <div
            style={{
              background: "#fff",
              border: "1px solid #e2e8f0",
              borderRadius: "0.75rem",
              padding: "1.5rem",
              marginBottom: "1.5rem",
            }}
          >
            <h3 style={{ margin: "0 0 0.5rem", fontSize: "1.1rem", fontWeight: 700, color: "#1e1b4b" }}>
              🔬 Run Candidate Model Benchmark Evaluation
            </h3>
            <p style={{ margin: "0 0 1rem", fontSize: "0.82rem", color: "#64748b" }}>
              Evaluate a candidate ASR architecture or fine-tuned model against a frozen, published dataset test split.
            </p>

            <form onSubmit={handleRunEvaluation}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: "1rem", marginBottom: "1rem" }}>
                <div>
                  <label style={{ fontSize: "0.78rem", fontWeight: 600, color: "#475569", display: "block", marginBottom: "0.25rem" }}>
                    Target Dataset
                  </label>
                  <select
                    value={selectedDataset?.id ?? ""}
                    onChange={(e) => {
                      const ds = datasets.find((d) => d.id === e.target.value);
                      if (ds) setSelectedDataset(ds);
                    }}
                    style={{ width: "100%", padding: "0.45rem", borderRadius: "0.4rem", border: "1px solid #cbd5e1", fontSize: "0.85rem" }}
                  >
                    {datasets.map((d) => (
                      <option key={d.id} value={d.id}>{d.version} ({d.title})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: "0.78rem", fontWeight: 600, color: "#475569", display: "block", marginBottom: "0.25rem" }}>
                    Candidate Model Name
                  </label>
                  <input
                    type="text"
                    value={evalModelName}
                    onChange={(e) => setEvalModelName(e.target.value)}
                    placeholder="e.g. IndicConformer-v2"
                    style={{ width: "100%", padding: "0.45rem", borderRadius: "0.4rem", border: "1px solid #cbd5e1", fontSize: "0.85rem" }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: "0.78rem", fontWeight: 600, color: "#475569", display: "block", marginBottom: "0.25rem" }}>
                    Model Version Tag
                  </label>
                  <input
                    type="text"
                    value={evalModelVersion}
                    onChange={(e) => setEvalModelVersion(e.target.value)}
                    placeholder="e.g. 2.0-rc2"
                    style={{ width: "100%", padding: "0.45rem", borderRadius: "0.4rem", border: "1px solid #cbd5e1", fontSize: "0.85rem" }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: "0.78rem", fontWeight: 600, color: "#475569", display: "block", marginBottom: "0.25rem" }}>
                    Split to Evaluate
                  </label>
                  <select
                    value={evalSplit}
                    onChange={(e) => setEvalSplit(e.target.value)}
                    style={{ width: "100%", padding: "0.45rem", borderRadius: "0.4rem", border: "1px solid #cbd5e1", fontSize: "0.85rem" }}
                  >
                    <option value="test">Test Split (Recommended)</option>
                    <option value="validation">Validation Split</option>
                    <option value="all">Full Dataset</option>
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: "0.78rem", fontWeight: 600, color: "#475569", display: "block", marginBottom: "0.25rem" }}>
                    Baseline WER (%)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={evalBaselineWer}
                    onChange={(e) => setEvalBaselineWer(Number(e.target.value))}
                    style={{ width: "100%", padding: "0.45rem", borderRadius: "0.4rem", border: "1px solid #cbd5e1", fontSize: "0.85rem" }}
                  />
                </div>
              </div>

              {evalError && <div style={{ color: "#dc2626", fontSize: "0.82rem", marginBottom: "0.75rem" }}>⚠️ {evalError}</div>}
              {evalSuccess && <div style={{ color: "#16a34a", fontSize: "0.82rem", marginBottom: "0.75rem", fontWeight: 600 }}>✅ {evalSuccess}</div>}

              <button
                type="submit"
                disabled={runningEval || datasets.length === 0}
                style={{
                  background: "#4f46e5",
                  color: "#fff",
                  border: "none",
                  padding: "0.6rem 1.5rem",
                  borderRadius: "0.5rem",
                  fontSize: "0.88rem",
                  fontWeight: 700,
                  cursor: datasets.length === 0 ? "not-allowed" : "pointer",
                }}
              >
                {runningEval ? "Evaluating Models..." : "▶️ Execute Benchmark Evaluation"}
              </button>
            </form>
          </div>

          {/* Evaluations List */}
          <div
            style={{
              background: "#fff",
              border: "1px solid #e2e8f0",
              borderRadius: "0.75rem",
              padding: "1.25rem",
            }}
          >
            <div style={{ fontSize: "0.85rem", fontWeight: 700, color: "#1e1b4b", marginBottom: "1rem" }}>
              Historical Evaluation Benchmark Results
            </div>

            {loadingEvals ? (
              <div style={{ padding: "2rem", textAlign: "center", color: "#94a3b8" }}>Loading evaluations...</div>
            ) : evaluations.length === 0 ? (
              <div style={{ padding: "2rem", textAlign: "center", color: "#94a3b8", fontSize: "0.85rem" }}>
                No model evaluations run yet. Run one above!
              </div>
            ) : (
              evaluations.map((ev) => (
                <div
                  key={ev.id}
                  style={{
                    background: "#f8fafc",
                    border: "1px solid #e2e8f0",
                    borderRadius: "0.5rem",
                    padding: "1rem",
                    marginBottom: "0.85rem",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.5rem" }}>
                    <div>
                      <span style={{ fontSize: "1rem", fontWeight: 700, color: "#0f172a" }}>
                        {ev.candidate_model_name} {ev.candidate_model_version}
                      </span>
                      <span style={{ fontSize: "0.78rem", color: "#64748b", marginLeft: "0.5rem" }}>
                        evaluated against <code>{ev.dataset_version || ev.dataset_id}</code> ({ev.split_evaluated} split)
                      </span>
                    </div>

                    {ev.is_promoted === 1 ? (
                      <span style={{ background: "#dcfce7", color: "#166534", padding: "0.2rem 0.5rem", borderRadius: "0.3rem", fontSize: "0.75rem", fontWeight: 700 }}>
                        ⭐ Promoted to Production Baseline
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handlePromote(ev.id)}
                        style={{
                          background: "#e0e7ff",
                          color: "#4338ca",
                          border: "none",
                          padding: "0.3rem 0.65rem",
                          borderRadius: "0.35rem",
                          fontSize: "0.75rem",
                          fontWeight: 600,
                          cursor: "pointer",
                        }}
                      >
                        Promote to Baseline
                      </button>
                    )}
                  </div>

                  {/* WER Metrics & Delta */}
                  <div style={{ display: "flex", gap: "1.5rem", alignItems: "center", margin: "0.5rem 0" }}>
                    <div>
                      <span style={{ fontSize: "0.75rem", color: "#64748b" }}>Candidate WER: </span>
                      <strong style={{ fontSize: "1.1rem", color: "#1e1b4b" }}>{ev.overall_wer ?? "—"}%</strong>
                    </div>
                    <div>
                      <span style={{ fontSize: "0.75rem", color: "#64748b" }}>Baseline WER: </span>
                      <strong style={{ fontSize: "1.1rem", color: "#64748b" }}>{ev.baseline_wer ?? "—"}%</strong>
                    </div>
                    <div>
                      <span style={{ fontSize: "0.75rem", color: "#64748b" }}>WER Delta: </span>
                      <strong
                        style={{
                          fontSize: "1.1rem",
                          color: ev.wer_delta && ev.wer_delta < 0 ? "#16a34a" : "#dc2626",
                        }}
                      >
                        {ev.wer_delta !== null ? (ev.wer_delta > 0 ? `+${ev.wer_delta}%` : `${ev.wer_delta}%`) : "—"}
                      </strong>
                    </div>
                    <div>
                      <span style={{ fontSize: "0.75rem", color: "#64748b" }}>Test Samples: </span>
                      <strong>{ev.total_samples}</strong>
                    </div>
                  </div>

                  {/* Limitation warning */}
                  {ev.sample_limitation_warning && (
                    <div style={{ color: "#d97706", fontSize: "0.75rem", background: "#fef3c7", padding: "0.4rem 0.6rem", borderRadius: "0.3rem", marginTop: "0.4rem" }}>
                      ⚠️ {ev.sample_limitation_warning}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Publish Snapshot Modal */}
      {showPublishModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: "1rem",
          }}
        >
          <div
            style={{
              background: "#fff",
              borderRadius: "1rem",
              maxWidth: 550,
              width: "100%",
              padding: "1.75rem",
              boxShadow: "0 20px 25px -5px rgba(0,0,0,0.2)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
              <h3 style={{ margin: 0, fontSize: "1.2rem", fontWeight: 700, color: "#1e1b4b" }}>
                🚀 Publish Frozen Dataset Snapshot
              </h3>
              <button
                type="button"
                onClick={() => setShowPublishModal(false)}
                style={{ background: "none", border: "none", fontSize: "1.25rem", cursor: "pointer", color: "#64748b" }}
              >
                ✕
              </button>
            </div>

            <p style={{ margin: "0 0 1rem", fontSize: "0.82rem", color: "#64748b" }}>
              Only records with human-verified <code>APPROVED</code> status, explicit consent, and no exclusions will be included.
              Published datasets are immutable to ensure benchmark reproducibility.
            </p>

            <form onSubmit={handlePublish}>
              <div style={{ marginBottom: "0.85rem" }}>
                <label style={{ fontSize: "0.78rem", fontWeight: 600, color: "#475569", display: "block", marginBottom: "0.2rem" }}>
                  Dataset Version Tag *
                </label>
                <input
                  type="text"
                  value={pubVersion}
                  onChange={(e) => setPubVersion(e.target.value)}
                  placeholder="e.g. v1.0.1"
                  style={{ width: "100%", padding: "0.5rem", borderRadius: "0.4rem", border: "1px solid #cbd5e1", fontSize: "0.85rem" }}
                />
              </div>

              <div style={{ marginBottom: "0.85rem" }}>
                <label style={{ fontSize: "0.78rem", fontWeight: 600, color: "#475569", display: "block", marginBottom: "0.2rem" }}>
                  Title *
                </label>
                <input
                  type="text"
                  value={pubTitle}
                  onChange={(e) => setPubTitle(e.target.value)}
                  placeholder="e.g. Indic Community Benchmark Snapshot"
                  style={{ width: "100%", padding: "0.5rem", borderRadius: "0.4rem", border: "1px solid #cbd5e1", fontSize: "0.85rem" }}
                />
              </div>

              <div style={{ marginBottom: "0.85rem" }}>
                <label style={{ fontSize: "0.78rem", fontWeight: 600, color: "#475569", display: "block", marginBottom: "0.2rem" }}>
                  Description
                </label>
                <textarea
                  value={pubDescription}
                  onChange={(e) => setPubDescription(e.target.value)}
                  rows={2}
                  style={{ width: "100%", padding: "0.5rem", borderRadius: "0.4rem", border: "1px solid #cbd5e1", fontSize: "0.85rem" }}
                />
              </div>

              <div style={{ marginBottom: "1rem" }}>
                <label style={{ fontSize: "0.78rem", fontWeight: 600, color: "#475569", display: "block", marginBottom: "0.2rem" }}>
                  Publisher Identity / Role *
                </label>
                <input
                  type="text"
                  value={pubPublisher}
                  onChange={(e) => setPubPublisher(e.target.value)}
                  placeholder="e.g. Chief Speech Data Architect"
                  style={{ width: "100%", padding: "0.5rem", borderRadius: "0.4rem", border: "1px solid #cbd5e1", fontSize: "0.85rem" }}
                />
              </div>

              <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.82rem", color: "#334155", marginBottom: "1.25rem", cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={pubSetActive}
                  onChange={(e) => setPubSetActive(e.target.checked)}
                />
                <span>Set this version as the Active Benchmark Baseline</span>
              </label>

              {publishError && <div style={{ color: "#dc2626", fontSize: "0.82rem", marginBottom: "0.75rem" }}>⚠️ {publishError}</div>}

              <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end" }}>
                <button
                  type="button"
                  onClick={() => setShowPublishModal(false)}
                  style={{
                    background: "#f1f5f9",
                    color: "#475569",
                    border: "1px solid #cbd5e1",
                    padding: "0.55rem 1rem",
                    borderRadius: "0.4rem",
                    fontSize: "0.85rem",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={publishing}
                  style={{
                    background: "#4f46e5",
                    color: "#fff",
                    border: "none",
                    padding: "0.55rem 1.25rem",
                    borderRadius: "0.4rem",
                    fontSize: "0.85rem",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  {publishing ? "Freezing Snapshot..." : "Confirm Publication"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
