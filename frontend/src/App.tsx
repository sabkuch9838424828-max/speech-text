import { useState, useCallback } from "react";
import { api } from "./api/client";
import { useAsync } from "./hooks/useAsync";
import { DistrictCard } from "./components/DistrictCard";
import { WerChart } from "./components/WerChart";
import { FilterBar } from "./components/FilterBar";
import { CoverageMatrix } from "./components/CoverageMatrix";
import { PriorityPanel } from "./components/PriorityPanel";
import { FeedbackModal } from "./components/FeedbackModal";
import type { WerResult, CollectionPriority } from "./types";
import { DEFAULT_THRESHOLDS } from "./types";

// ---------- Shared UI helpers ----------

function LoadingSpinner({ label }: { label: string }) {
  return (
    <div
      role="status"
      aria-label={label}
      style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem", padding: "2rem", color: "#9ca3af" }}
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" style={{ animation: "spin 1s linear infinite" }}>
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
            <code>uvicorn app.main:app --reload</code>
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

function EmptyState({ message }: { message: string }) {
  return (
    <div style={{ padding: "2rem", textAlign: "center", color: "#9ca3af", background: "#f9fafb", borderRadius: "0.75rem" }}>
      <p style={{ margin: 0, fontSize: "0.9rem" }}>{message}</p>
    </div>
  );
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2
      style={{
        fontSize: "1.1rem",
        fontWeight: 700,
        color: "#1f2937",
        margin: "0 0 1rem",
        borderBottom: "2px solid #f3f4f6",
        paddingBottom: "0.5rem",
      }}
    >
      {children}
    </h2>
  );
}

// ---------- Main App ----------

type TabId = "overview" | "detail" | "coverage" | "priorities";

export default function App() {
  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const [selectedDistrict, setSelectedDistrict] = useState("");
  const [selectedGender, setSelectedGender] = useState("");
  const [selectedAgeGroup, setSelectedAgeGroup] = useState("");
  const [feedbackTarget, setFeedbackTarget] = useState<CollectionPriority | null>(null);

  // Fetch districts for filter dropdown
  const { data: districtsData, error: districtsError } = useAsync(
    () => api.districts(),
    []
  );
  const districts = districtsData?.districts ?? [];

  // Overview data
  const {
    data: overviewData,
    loading: overviewLoading,
    error: overviewError,
    refetch: refetchOverview,
  } = useAsync(
    useCallback(() => api.werOverview({ ...DEFAULT_THRESHOLDS }), []),
    []
  );

  // Detail data (filtered)
  const detailFetcher = useCallback(() => {
    if (!selectedDistrict) return Promise.resolve(null);
    return api.werDetail({
      district: selectedDistrict,
      gender: selectedGender || undefined,
      age_group: selectedAgeGroup || undefined,
      ...DEFAULT_THRESHOLDS,
    });
  }, [selectedDistrict, selectedGender, selectedAgeGroup]);

  const {
    data: detailData,
    loading: detailLoading,
    error: detailError,
    refetch: refetchDetail,
  } = useAsync(detailFetcher, [selectedDistrict, selectedGender, selectedAgeGroup]);

  // Coverage matrix
  const {
    data: coverageData,
    loading: coverageLoading,
    error: coverageError,
    refetch: refetchCoverage,
  } = useAsync(
    useCallback(
      () => api.coverageMatrix({ min_recordings: DEFAULT_THRESHOLDS.min_recordings }),
      []
    ),
    []
  );

  // Priorities
  const {
    data: prioritiesData,
    loading: prioritiesLoading,
    error: prioritiesError,
    refetch: refetchPriorities,
  } = useAsync(
    useCallback(
      () =>
        api.priorities({
          min_recordings: DEFAULT_THRESHOLDS.min_recordings,
          high_wer_threshold: DEFAULT_THRESHOLDS.high_wer_threshold,
        }),
      []
    ),
    []
  );

  const resetFilters = () => {
    setSelectedDistrict("");
    setSelectedGender("");
    setSelectedAgeGroup("");
  };

  const handleDistrictClick = (district: string) => {
    setSelectedDistrict(district);
    setActiveTab("detail");
  };

  const tabs: { id: TabId; label: string }[] = [
    { id: "overview", label: "📊 Overview" },
    { id: "detail", label: "🔍 Detail View" },
    { id: "coverage", label: "🗺 Coverage Matrix" },
    { id: "priorities", label: "📋 Collection Priorities" },
  ];

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#f9fafb",
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

      {/* Header */}
      <header style={{ background: "#fff", borderBottom: "1px solid #e5e7eb", padding: "0 1.5rem" }}>
        <div
          style={{
            maxWidth: "1200px",
            margin: "0 auto",
            padding: "1rem 0",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "0.5rem",
          }}
        >
          <div>
            <h1 style={{ margin: 0, fontSize: "1.4rem", fontWeight: 800, color: "#1f2937" }}>
              🔤 BhashaLens
            </h1>
            <p style={{ margin: "0.1rem 0 0", fontSize: "0.78rem", color: "#6b7280" }}>
              District WER Dashboard · Bhasha & Bol Bharat Hackathon
            </p>
          </div>
          <div
            role="note"
            aria-label="Demo data warning"
            style={{
              background: "#fef9c3",
              border: "1px solid #fcd34d",
              borderRadius: "0.5rem",
              padding: "0.35rem 0.75rem",
              fontSize: "0.75rem",
              fontWeight: 700,
              color: "#92400e",
            }}
          >
            ⚠ ILLUSTRATIVE DEMO DATA — not real district performance
          </div>
        </div>
      </header>

      {/* Nav tabs */}
      <nav aria-label="Dashboard sections" style={{ background: "#fff", borderBottom: "1px solid #e5e7eb" }}>
        <div
          style={{
            maxWidth: "1200px",
            margin: "0 auto",
            padding: "0 1.5rem",
            display: "flex",
            overflowX: "auto",
          }}
        >
          {tabs.map((tab) => (
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

      {/* Main content */}
      <main style={{ maxWidth: "1200px", margin: "0 auto", padding: "1.5rem" }}>
        {districtsError && (
          <ErrorMessage message={`Could not load districts: ${districtsError}`} />
        )}

        {/* ---- Overview ---- */}
        {activeTab === "overview" && (
          <section aria-labelledby="heading-overview">
            <SectionHeading>District Overview</SectionHeading>
            {overviewLoading && <LoadingSpinner label="Loading overview data…" />}
            {overviewError && (
              <ErrorMessage message={overviewError} onRetry={refetchOverview} />
            )}
            {!overviewLoading && !overviewError && overviewData && (
              <>
                {overviewData.length === 0 ? (
                  <EmptyState message="No district data available." />
                ) : (
                  <>
                    <div
                      style={{
                        background: "#fff",
                        borderRadius: "0.75rem",
                        padding: "1.25rem",
                        marginBottom: "1.5rem",
                        border: "1px solid #e5e7eb",
                      }}
                    >
                      <h3
                        style={{
                          margin: "0 0 1rem",
                          fontSize: "0.9rem",
                          fontWeight: 600,
                          color: "#6b7280",
                        }}
                      >
                        WER by District (aggregated across all genders & ages)
                      </h3>
                      <WerChart
                        data={overviewData}
                        highWerThreshold={DEFAULT_THRESHOLDS.high_wer_threshold}
                      />
                    </div>
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
                        gap: "1rem",
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

        {/* ---- Detail View ---- */}
        {activeTab === "detail" && (
          <section aria-labelledby="heading-detail">
            <SectionHeading>Filtered Detail View</SectionHeading>
            <FilterBar
              districts={districts}
              selectedDistrict={selectedDistrict}
              selectedGender={selectedGender}
              selectedAgeGroup={selectedAgeGroup}
              onDistrictChange={setSelectedDistrict}
              onGenderChange={setSelectedGender}
              onAgeGroupChange={setSelectedAgeGroup}
              onReset={resetFilters}
            />
            <div style={{ marginTop: "1.25rem" }}>
              {!selectedDistrict ? (
                <EmptyState message="Select a district above to view detailed WER breakdown." />
              ) : detailLoading ? (
                <LoadingSpinner label="Loading detail…" />
              ) : detailError ? (
                <ErrorMessage message={detailError} onRetry={refetchDetail} />
              ) : detailData ? (
                <div style={{ maxWidth: "480px" }}>
                  <DistrictCard result={detailData} />
                </div>
              ) : null}
            </div>
          </section>
        )}

        {/* ---- Coverage Matrix ---- */}
        {activeTab === "coverage" && (
          <section aria-labelledby="heading-coverage">
            <SectionHeading>Evidence Coverage Matrix</SectionHeading>
            <p style={{ margin: "0 0 1.25rem", fontSize: "0.85rem", color: "#6b7280", lineHeight: 1.6 }}>
              Each cell shows the recording count for a district × gender × age group
              combination. Cells with 0 have no evidence — they are{" "}
              <strong>not 0% WER</strong>. Click any cell to see the filtered detail
              view.
            </p>
            {coverageLoading && <LoadingSpinner label="Loading coverage matrix…" />}
            {coverageError && (
              <ErrorMessage message={coverageError} onRetry={refetchCoverage} />
            )}
            {!coverageLoading && !coverageError && coverageData && (
              <div
                style={{
                  background: "#fff",
                  borderRadius: "0.75rem",
                  padding: "1.25rem",
                  border: "1px solid #e5e7eb",
                }}
              >
                <CoverageMatrix
                  data={coverageData}
                  onCellClick={(district, gender, ageGroup) => {
                    setSelectedDistrict(district);
                    setSelectedGender(gender);
                    setSelectedAgeGroup(ageGroup);
                    setActiveTab("detail");
                  }}
                />
              </div>
            )}
          </section>
        )}

        {/* ---- Priorities ---- */}
        {activeTab === "priorities" && (
          <section aria-labelledby="heading-priorities">
            <SectionHeading>Recording Collection Priorities</SectionHeading>
            <p style={{ margin: "0 0 1.25rem", fontSize: "0.85rem", color: "#6b7280", lineHeight: 1.6 }}>
              Groups ranked by urgency of data collection. Click{" "}
              <strong>Review</strong> to submit community feedback before any
              collection campaign begins.
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
                onGiveFeedback={setFeedbackTarget}
              />
            )}
          </section>
        )}
      </main>

      {feedbackTarget && (
        <FeedbackModal
          priority={feedbackTarget}
          onClose={() => setFeedbackTarget(null)}
        />
      )}
    </div>
  );
}
