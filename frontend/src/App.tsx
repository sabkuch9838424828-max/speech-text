import { useState, useCallback } from "react";
import { api } from "./api/client";
import { useAsync } from "./hooks/useAsync";
import { ThresholdBar } from "./components/ThresholdBar";
import { MetricsRibbon } from "./components/MetricsRibbon";
import { DistrictCard } from "./components/DistrictCard";
import { WerChart } from "./components/WerChart";
import { FilterBar } from "./components/FilterBar";
import { CoverageMatrix } from "./components/CoverageMatrix";
import { ErrorDecomposition } from "./components/ErrorDecomposition";
import { PriorityPanel } from "./components/PriorityPanel";
import { MathModal } from "./components/MathModal";
import { OverrideDrawer } from "./components/OverrideDrawer";
import type {
  WerResult,
  WerCellDetail,
  CoverageCell,
  CollectionPriority,
  Thresholds,
} from "./types";
import { DEFAULT_THRESHOLDS } from "./types";

// ─── Shared UI helpers ────────────────────────────────────────────────────────

function LoadingSpinner({ label }: { label: string }) {
  return (
    <div
      role="status"
      aria-label={label}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "0.5rem",
        padding: "2rem",
        color: "#9ca3af",
      }}
    >
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        style={{ animation: "spin 1s linear infinite" }}
      >
        <circle cx="12" cy="12" r="10" stroke="#e5e7eb" strokeWidth="3" />
        <path d="M12 2a10 10 0 0 1 10 10" stroke="#6366f1" strokeWidth="3" strokeLinecap="round" />
      </svg>
      <span>{label}</span>
    </div>
  );
}

function ErrorMessage({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div
      role="alert"
      style={{
        background: "#fef2f2",
        border: "1px solid #fca5a5",
        borderRadius: "0.75rem",
        padding: "1rem 1.25rem",
        color: "#dc2626",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: "1rem",
      }}
    >
      <div>
        <strong>Error:</strong> {message}
        {message.includes("fetch") && (
          <p style={{ margin: "0.25rem 0 0", fontSize: "0.8rem", color: "#ef4444" }}>
            Is the backend running? Start it with:{" "}
            <code>cd backend && uvicorn app.main:app --reload</code>
          </p>
        )}
      </div>
      {onRetry && (
        <button
          onClick={onRetry}
          style={{
            padding: "0.35rem 0.75rem",
            background: "#fff",
            border: "1px solid #fca5a5",
            borderRadius: "0.5rem",
            color: "#dc2626",
            cursor: "pointer",
            fontSize: "0.82rem",
            whiteSpace: "nowrap",
          }}
        >
          Retry
        </button>
      )}
    </div>
  );
}

function EmptyState({ message, icon }: { message: string; icon?: string }) {
  return (
    <div
      style={{
        padding: "2.5rem",
        textAlign: "center",
        color: "#9ca3af",
        background: "#f9fafb",
        borderRadius: "0.75rem",
        border: "1px dashed #e5e7eb",
      }}
    >
      {icon && <div style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>{icon}</div>}
      <p style={{ margin: 0, fontSize: "0.875rem" }}>{message}</p>
    </div>
  );
}

// ─── Tab types ────────────────────────────────────────────────────────────────

type TabId = "overview" | "coverage" | "diagnostics" | "action";

const TABS: { id: TabId; label: string }[] = [
  { id: "overview", label: "🏛️ District Overview" },
  { id: "coverage", label: "🧩 Coverage Matrix" },
  { id: "diagnostics", label: "🔬 Diagnostics" },
  { id: "action", label: "📋 Action Plan" },
];

// ─── Main App ─────────────────────────────────────────────────────────────────

export default function App() {
  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const [thresholds, setThresholds] = useState<Thresholds>(DEFAULT_THRESHOLDS);

  // Filter state (Coverage Matrix tab)
  const [filterDistrict, setFilterDistrict] = useState("");
  const [filterGender, setFilterGender] = useState("");
  const [filterAgeGroup, setFilterAgeGroup] = useState("");

  // Selected cell for Diagnostics / ErrorDecomposition
  const [selectedCell, setSelectedCell] = useState<{
    district: string;
    gender: string;
    age_group: string;
  } | null>(null);

  // Math Modal (WER formula)
  const [mathModalCell, setMathModalCell] = useState<WerCellDetail | null>(null);
  const [mathModalLoading, setMathModalLoading] = useState(false);

  // Override Drawer (Action Plan)
  const [overrideTarget, setOverrideTarget] = useState<CollectionPriority | null>(null);

  // ── Data fetching ──────────────────────────────────────────────────────────

  const { data: districtsData } = useAsync(() => api.districts(), []);
  const districts = districtsData?.districts ?? [];

  const { data: summaryData, loading: summaryLoading, refetch: refetchSummary } = useAsync(
    useCallback(
      () => api.summary(thresholds),
      [thresholds]
    ),
    [thresholds]
  );

  const {
    data: overviewData,
    loading: overviewLoading,
    error: overviewError,
    refetch: refetchOverview,
  } = useAsync(
    useCallback(() => api.werOverview(thresholds), [thresholds]),
    [thresholds]
  );

  const {
    data: coverageData,
    loading: coverageLoading,
    error: coverageError,
    refetch: refetchCoverage,
  } = useAsync(
    useCallback(() => api.coverageMatrix(thresholds), [thresholds]),
    [thresholds]
  );

  const {
    data: prioritiesData,
    loading: prioritiesLoading,
    error: prioritiesError,
    refetch: refetchPriorities,
  } = useAsync(
    useCallback(() => api.priorities(thresholds), [thresholds]),
    [thresholds]
  );

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleCellSelect = (district: string, gender: string, age_group: string) => {
    setSelectedCell({ district, gender, age_group });
    setActiveTab("diagnostics");
  };

  const handleWerClick = async (cell: CoverageCell) => {
    setMathModalLoading(true);
    try {
      const detail = await api.werCellDetail({
        district: cell.district,
        gender: cell.gender,
        age_group: cell.age_group,
        ...thresholds,
      });
      setMathModalCell(detail);
    } catch {
      // Show inline math from cell data as fallback
      setMathModalCell({
        district: cell.district,
        gender: cell.gender,
        age_group: cell.age_group,
        status: cell.status,
        wer_pct: cell.wer_pct,
        naive_average_wer_pct: null,
        recording_count: cell.recording_count,
        reference_word_count: cell.reference_word_count,
        substitutions: cell.substitutions,
        deletions: cell.deletions,
        insertions: cell.insertions,
      });
    } finally {
      setMathModalLoading(false);
    }
  };

  const handleDistrictClick = (district: string) => {
    setFilterDistrict(district);
    setActiveTab("coverage");
  };

  // Derive selected cell's coverage data
  const selectedCoverageCell: CoverageCell | null = (() => {
    if (!selectedCell || !coverageData) return null;
    return (
      coverageData.cells.find(
        (c) =>
          c.district === selectedCell.district &&
          c.gender === selectedCell.gender &&
          c.age_group === selectedCell.age_group
      ) ?? null
    );
  })();

  // Filter coverage data
  const filteredCoverage = coverageData
    ? {
        ...coverageData,
        districts: filterDistrict
          ? coverageData.districts.filter((d) => d === filterDistrict)
          : coverageData.districts,
        genders: filterGender
          ? coverageData.genders.filter((g) => g === filterGender)
          : coverageData.genders,
        age_groups: filterAgeGroup
          ? coverageData.age_groups.filter((a) => a === filterAgeGroup)
          : coverageData.age_groups,
      }
    : null;

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#f8fafc",
        fontFamily: "system-ui, -apple-system, sans-serif",
      }}
    >
      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        * { box-sizing: border-box; }
        button:focus-visible, a:focus-visible, select:focus-visible,
        input:focus-visible, textarea:focus-visible {
          outline: 2px solid #6366f1;
          outline-offset: 2px;
        }
      `}</style>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header
        style={{ background: "#fff", borderBottom: "1px solid #e5e7eb" }}
      >
        <div
          style={{
            maxWidth: "1400px",
            margin: "0 auto",
            padding: "0.75rem 1.5rem",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "0.5rem",
          }}
        >
          <div>
            <h1 style={{ margin: 0, fontSize: "1.35rem", fontWeight: 800, color: "#1f2937" }}>
              🌐 BhashaLens
            </h1>
            <p style={{ margin: "0.1rem 0 0", fontSize: "0.75rem", color: "#6b7280" }}>
              District WER &amp; Speech Data Coverage Explorer · Bhasha &amp; Bol Bharat Hackathon
            </p>
          </div>
          <div
            role="note"
            aria-label="Demo data warning"
            style={{
              background: "#fef9c3",
              border: "1px solid #fcd34d",
              borderRadius: "0.5rem",
              padding: "0.4rem 0.85rem",
              fontSize: "0.72rem",
              fontWeight: 700,
              color: "#92400e",
              textAlign: "center",
            }}
          >
            ⚠ ILLUSTRATIVE BENCHMARK DATASET<br />
            <span style={{ fontWeight: 400 }}>For Evaluation &amp; Methodology Demonstration Only</span>
          </div>
        </div>
      </header>

      {/* ── Threshold Bar ──────────────────────────────────────────────────── */}
      <ThresholdBar value={thresholds} onChange={setThresholds} />

      {/* ── Metrics Ribbon ─────────────────────────────────────────────────── */}
      <MetricsRibbon stats={summaryData ?? null} loading={summaryLoading} />

      {/* ── Nav Tabs ───────────────────────────────────────────────────────── */}
      <nav
        aria-label="Dashboard sections"
        style={{ background: "#fff", borderBottom: "1px solid #e5e7eb" }}
      >
        <div
          style={{
            maxWidth: "1400px",
            margin: "0 auto",
            padding: "0 1.5rem",
            display: "flex",
            overflowX: "auto",
          }}
        >
          {TABS.map((tab) => (
            <button
              key={tab.id}
              role="tab"
              aria-selected={activeTab === tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                padding: "0.75rem 1.25rem",
                background: "none",
                border: "none",
                borderBottom:
                  activeTab === tab.id ? "2px solid #6366f1" : "2px solid transparent",
                color: activeTab === tab.id ? "#6366f1" : "#6b7280",
                fontWeight: activeTab === tab.id ? 700 : 500,
                fontSize: "0.875rem",
                cursor: "pointer",
                whiteSpace: "nowrap",
                transition: "color 0.15s, border-color 0.15s",
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </nav>

      {/* ── Main Content ───────────────────────────────────────────────────── */}
      <main style={{ maxWidth: "1400px", margin: "0 auto", padding: "1.25rem 1.5rem" }}>

        {/* ═══ Tab 1: District Overview ═══════════════════════════════════════ */}
        {activeTab === "overview" && (
          <section aria-labelledby="heading-overview">
            <h2
              id="heading-overview"
              style={{ margin: "0 0 1rem", fontSize: "1rem", fontWeight: 700, color: "#1f2937" }}
            >
              District Overview
            </h2>

            {overviewLoading && <LoadingSpinner label="Loading overview…" />}
            {overviewError && (
              <ErrorMessage message={overviewError} onRetry={refetchOverview} />
            )}

            {!overviewLoading && !overviewError && overviewData && (
              <>
                {overviewData.length === 0 ? (
                  <EmptyState message="No district data available." icon="🗺️" />
                ) : (
                  <>
                    {/* WER Chart */}
                    <div
                      style={{
                        background: "#fff",
                        borderRadius: "0.75rem",
                        padding: "1.25rem",
                        marginBottom: "1.25rem",
                        border: "1px solid #e5e7eb",
                      }}
                    >
                      <p
                        style={{
                          margin: "0 0 0.75rem",
                          fontSize: "0.8rem",
                          fontWeight: 600,
                          color: "#6b7280",
                        }}
                      >
                        WER by District — aggregate across all genders &amp; age groups. Red dashed line = alert threshold ({thresholds.high_wer_threshold}%).
                        Click a bar to view its coverage.
                      </p>
                      <WerChart
                        data={overviewData}
                        highWerThreshold={thresholds.high_wer_threshold}
                        onBarClick={handleDistrictClick}
                      />
                    </div>

                    {/* District cards */}
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
                        gap: "0.75rem",
                      }}
                    >
                      {overviewData.map((result: WerResult) => (
                        <DistrictCard
                          key={result.district}
                          result={result}
                          onClick={() => handleDistrictClick(result.district)}
                        />
                      ))}
                    </div>
                  </>
                )}
              </>
            )}
          </section>
        )}

        {/* ═══ Tab 2: Coverage Matrix ══════════════════════════════════════════ */}
        {activeTab === "coverage" && (
          <section aria-labelledby="heading-coverage">
            <h2
              id="heading-coverage"
              style={{ margin: "0 0 0.75rem", fontSize: "1rem", fontWeight: 700, color: "#1f2937" }}
            >
              Evidence Coverage Matrix
            </h2>
            <p style={{ margin: "0 0 1rem", fontSize: "0.8rem", color: "#6b7280", lineHeight: 1.6 }}>
              Each cell shows WER or recording count for a district × gender × age group.
              <strong> No data ≠ 0% WER.</strong> Click a cell to inspect it in Diagnostics.
              Click a WER% to see the aggregate formula.
            </p>

            {/* Filters */}
            <FilterBar
              districts={districts}
              selectedDistrict={filterDistrict}
              selectedGender={filterGender}
              selectedAgeGroup={filterAgeGroup}
              onDistrictChange={setFilterDistrict}
              onGenderChange={setFilterGender}
              onAgeGroupChange={setFilterAgeGroup}
              onReset={() => {
                setFilterDistrict("");
                setFilterGender("");
                setFilterAgeGroup("");
              }}
            />

            <div style={{ marginTop: "1rem" }}>
              {coverageLoading && <LoadingSpinner label="Loading coverage matrix…" />}
              {coverageError && (
                <ErrorMessage message={coverageError} onRetry={refetchCoverage} />
              )}

              {!coverageLoading && !coverageError && filteredCoverage && (
                <div
                  style={{
                    background: "#fff",
                    borderRadius: "0.75rem",
                    padding: "1rem",
                    border: "1px solid #e5e7eb",
                  }}
                >
                  <CoverageMatrix
                    data={filteredCoverage}
                    onCellSelect={handleCellSelect}
                    onWerClick={handleWerClick}
                    selectedCell={selectedCell}
                  />
                </div>
              )}
            </div>

            {/* Split view: ErrorDecomposition + PriorityPanel */}
            {selectedCoverageCell && (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "1rem",
                  marginTop: "1rem",
                }}
              >
                <div
                  style={{
                    background: "#fff",
                    borderRadius: "0.75rem",
                    padding: "1rem",
                    border: "1px solid #e5e7eb",
                  }}
                >
                  <ErrorDecomposition cell={selectedCoverageCell} />
                </div>
                <div
                  style={{
                    background: "#fff",
                    borderRadius: "0.75rem",
                    padding: "1rem",
                    border: "1px solid #e5e7eb",
                  }}
                >
                  <h3
                    style={{
                      margin: "0 0 0.75rem",
                      fontSize: "0.875rem",
                      fontWeight: 700,
                      color: "#374151",
                    }}
                  >
                    📋 Top Collection Priorities
                  </h3>
                  {prioritiesData && (
                    <PriorityPanel
                      priorities={prioritiesData.priorities.slice(0, 5)}
                      disclaimer={prioritiesData.disclaimer}
                      thresholds={prioritiesData.thresholds}
                      onGiveFeedback={setOverrideTarget}
                    />
                  )}
                </div>
              </div>
            )}
          </section>
        )}

        {/* ═══ Tab 3: Diagnostics ══════════════════════════════════════════════ */}
        {activeTab === "diagnostics" && (
          <section aria-labelledby="heading-diagnostics">
            <h2
              id="heading-diagnostics"
              style={{ margin: "0 0 1rem", fontSize: "1rem", fontWeight: 700, color: "#1f2937" }}
            >
              Diagnostics
            </h2>

            {!selectedCell ? (
              <EmptyState
                icon="🧩"
                message="Click any cell in the Coverage Matrix tab to inspect its error breakdown here."
              />
            ) : !selectedCoverageCell ? (
              <EmptyState
                icon="⚪"
                message={`No data available for ${selectedCell.district} · ${selectedCell.gender} · ${selectedCell.age_group}.`}
              />
            ) : (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "1rem",
                }}
              >
                {/* Error decomposition */}
                <div
                  style={{
                    background: "#fff",
                    borderRadius: "0.75rem",
                    padding: "1.25rem",
                    border: "1px solid #e5e7eb",
                  }}
                >
                  <ErrorDecomposition cell={selectedCoverageCell} />
                </div>

                {/* WER detail card */}
                <div
                  style={{
                    background: "#fff",
                    borderRadius: "0.75rem",
                    padding: "1.25rem",
                    border: "1px solid #e5e7eb",
                  }}
                >
                  <h3
                    style={{ margin: "0 0 0.75rem", fontSize: "0.875rem", fontWeight: 700, color: "#374151" }}
                  >
                    🔢 Cell Summary
                  </h3>
                  <dl style={{ margin: 0, display: "grid", gridTemplateColumns: "auto 1fr", gap: "0.35rem 1rem", fontSize: "0.82rem" }}>
                    {[
                      ["District", selectedCoverageCell.district],
                      ["Gender", selectedCoverageCell.gender],
                      ["Age Group", selectedCoverageCell.age_group],
                      ["Status", selectedCoverageCell.status.replace("_", " ")],
                      ["Recordings", selectedCoverageCell.recording_count],
                      ["Ref. Words", selectedCoverageCell.reference_word_count.toLocaleString()],
                      ["WER", selectedCoverageCell.wer_pct !== null ? `${selectedCoverageCell.wer_pct.toFixed(1)}%` : "—"],
                      ["Substitutions", selectedCoverageCell.substitutions],
                      ["Deletions", selectedCoverageCell.deletions],
                      ["Insertions", selectedCoverageCell.insertions],
                    ].map(([term, def]) => (
                      <>
                        <dt key={`dt-${term}`} style={{ color: "#6b7280", fontWeight: 600 }}>{term}</dt>
                        <dd key={`dd-${term}`} style={{ margin: 0, color: "#1f2937", fontWeight: 500 }}>{def}</dd>
                      </>
                    ))}
                  </dl>
                  {selectedCoverageCell.wer_pct !== null && (
                    <button
                      onClick={() => handleWerClick(selectedCoverageCell)}
                      disabled={mathModalLoading}
                      style={{
                        marginTop: "1rem",
                        padding: "0.45rem 1rem",
                        background: "#f0f4ff",
                        border: "1px solid #c7d2fe",
                        borderRadius: "0.5rem",
                        color: "#4f46e5",
                        fontWeight: 600,
                        fontSize: "0.8rem",
                        cursor: "pointer",
                      }}
                    >
                      {mathModalLoading ? "Loading…" : "🔬 View WER Formula"}
                    </button>
                  )}
                </div>
              </div>
            )}
          </section>
        )}

        {/* ═══ Tab 4: Action Plan ══════════════════════════════════════════════ */}
        {activeTab === "action" && (
          <section aria-labelledby="heading-action">
            <h2
              id="heading-action"
              style={{ margin: "0 0 0.75rem", fontSize: "1rem", fontWeight: 700, color: "#1f2937" }}
            >
              Action Plan — Recording Collection Priorities
            </h2>
            <p style={{ margin: "0 0 1rem", fontSize: "0.8rem", color: "#6b7280", lineHeight: 1.6 }}>
              Groups ranked by urgency. Click <strong>Review</strong> to submit a community override
              before any campaign begins. Overrides require human sign-off.
            </p>

            {prioritiesLoading && <LoadingSpinner label="Loading priorities…" />}
            {prioritiesError && (
              <ErrorMessage message={prioritiesError} onRetry={refetchPriorities} />
            )}
            {!prioritiesLoading && !prioritiesError && prioritiesData && (
              <PriorityPanel
                priorities={prioritiesData.priorities}
                disclaimer={prioritiesData.disclaimer}
                thresholds={prioritiesData.thresholds}
                onGiveFeedback={setOverrideTarget}
              />
            )}
          </section>
        )}
      </main>

      {/* ── Math Modal ──────────────────────────────────────────────────────── */}
      {mathModalCell && (
        <MathModal cell={mathModalCell} onClose={() => setMathModalCell(null)} />
      )}

      {/* ── Override Drawer ─────────────────────────────────────────────────── */}
      {overrideTarget && (
        <OverrideDrawer
          priority={overrideTarget}
          thresholds={thresholds}
          onClose={() => setOverrideTarget(null)}
          onSubmitSuccess={() => {
            refetchPriorities();
            refetchSummary();
          }}
        />
      )}
    </div>
  );
}
