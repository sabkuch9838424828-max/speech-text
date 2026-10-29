import { useState, useEffect, useCallback } from "react";
import { api, setStoredToken, getStoredToken } from "./api/client";
import { useAsync } from "./hooks/useAsync";
import { AppHeader } from "./components/AppHeader";
import { AuthModal } from "./components/Auth/AuthModal";

// User Portal Components
import { UserDashboard } from "./components/UserPortal/UserDashboard";
import { AiSubmissionPage } from "./components/UserPortal/AiSubmissionPage";
import { UserSubmissionsHistory } from "./components/UserPortal/UserSubmissionsHistory";
import { SubmissionDetailView } from "./components/UserPortal/SubmissionDetailView";
import { UserProfileView } from "./components/UserPortal/UserProfileView";

// Admin Portal Components
import { AdminDashboard } from "./components/AdminPortal/AdminDashboard";
import { UserManagement } from "./components/AdminPortal/UserManagement";
import { AdminSubmissionsView } from "./components/AdminPortal/AdminSubmissionsView";
import { AdminSettings } from "./components/AdminPortal/AdminSettings";

// Reused Analytical Components
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
import { ReviewQueue } from "./components/ReviewQueue";
import { DatasetGovernance } from "./components/DatasetGovernance";
import { CommunityMetricsRibbon } from "./components/CommunityMetricsRibbon";

import type {
  User,
  WerResult,
  WerCellDetail,
  CoverageCell,
  CollectionPriority,
  Thresholds,
} from "./types";
import { DEFAULT_THRESHOLDS } from "./types";

// ── Shared UI helpers ────────────────────────────────────────────────────────

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
        color: "#64748B",
      }}
    >
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        style={{ animation: "spin 1s linear infinite" }}
      >
        <circle cx="12" cy="12" r="10" stroke="#E2E8F0" strokeWidth="3" />
        <path d="M12 2a10 10 0 0 1 10 10" stroke="#2563EB" strokeWidth="3" strokeLinecap="round" />
      </svg>
      <span style={{ fontSize: "0.85rem", fontWeight: 500 }}>{label}</span>
    </div>
  );
}

function ErrorMessage({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div
      role="alert"
      style={{
        background: "#FEF2F2",
        border: "1px solid #FECACA",
        borderRadius: "10px",
        padding: "1rem 1.25rem",
        color: "#DC2626",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: "1rem",
        marginBottom: "1rem",
      }}
    >
      <div>
        <strong>Error:</strong> {message}
        {message.includes("fetch") && (
          <p style={{ margin: "0.25rem 0 0", fontSize: "0.8rem", color: "#EF4444" }}>
            Is the backend running? Start with: <code>python -m uvicorn app.main:app --reload</code>
          </p>
        )}
      </div>
      {onRetry && (
        <button
          onClick={onRetry}
          style={{
            padding: "0.35rem 0.75rem",
            background: "#FFFFFF",
            border: "1px solid #FECACA",
            borderRadius: "6px",
            color: "#DC2626",
            cursor: "pointer",
            fontSize: "0.82rem",
            fontWeight: 600,
          }}
        >
          Retry
        </button>
      )}
    </div>
  );
}

// ── Tab Navigation Configs ───────────────────────────────────────────────────

const USER_TABS = [
  { path: "/app", label: "🏠 Contributor Dashboard" },
  { path: "/app/submit", label: "🎙️ Submit New Input" },
  { path: "/app/submissions", label: "📄 My Submissions History" },
  { path: "/app/profile", label: "👤 Profile & Settings" },
];

const ADMIN_TABS = [
  { path: "/admin", label: "📊 Governance Overview" },
  { path: "/admin/users", label: "👥 User Management" },
  { path: "/admin/submissions", label: "📁 All Submissions" },
  { path: "/admin/review", label: "🧑‍🔬 Review Queue" },
  { path: "/admin/coverage", label: "🧩 Coverage Matrix" },
  { path: "/admin/diagnostics", label: "🔬 Diagnostics" },
  { path: "/admin/action-plan", label: "📋 Action Plan" },
  { path: "/admin/governance", label: "📦 Datasets & Benchmark" },
  { path: "/admin/settings", label: "⚙️ Settings" },
];

export default function App() {
  // Navigation & URL state
  const [currentPath, setCurrentPath] = useState<string>(() => {
    if (typeof window !== "undefined") {
      const p = window.location.pathname;
      return p && p !== "/" ? p : "/app";
    }
    return "/app";
  });

  // Auth state
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authModalMode, setAuthModalMode] = useState<"login" | "register" | "admin_login" | null>(null);
  const [checkingAuth, setCheckingAuth] = useState<boolean>(true);

  // App settings state
  const [thresholds, setThresholds] = useState<Thresholds>(DEFAULT_THRESHOLDS);
  const [dataTier, setDataTier] = useState<"demo" | "community" | "combined">("combined");

  // Filter state for Coverage Matrix
  const [filterDistrict, setFilterDistrict] = useState("");
  const [filterGender, setFilterGender] = useState("");
  const [filterAgeGroup, setFilterAgeGroup] = useState("");

  // Selected cell for Diagnostics / ErrorDecomposition
  const [selectedCell, setSelectedCell] = useState<{
    district: string;
    gender: string;
    age_group: string;
  } | null>(null);

  // Selected submission ID for detail view
  const [detailSubmissionId, setDetailSubmissionId] = useState<string | null>(null);

  // Math Modal (WER formula)
  const [mathModalCell, setMathModalCell] = useState<WerCellDetail | null>(null);
  const [mathModalLoading, setMathModalLoading] = useState(false);

  // Override Drawer (Action Plan)
  const [overrideTarget, setOverrideTarget] = useState<CollectionPriority | null>(null);

  // Derive current portal: "admin" if path starts with "/admin", otherwise "user"
  const currentPortal: "user" | "admin" = currentPath.startsWith("/admin") ? "admin" : "user";

  // URL synchronization
  const navigateTo = useCallback((path: string) => {
    if (typeof window !== "undefined") {
      window.history.pushState({}, "", path);
    }
    setCurrentPath(path);
    if (!path.startsWith("/app/submissions/")) {
      setDetailSubmissionId(null);
    }
  }, []);

  useEffect(() => {
    const handlePopState = () => {
      const p = window.location.pathname;
      setCurrentPath(p && p !== "/" ? p : "/app");
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  // Initial Auth Check: load current user from token or auto-login default demo user
  useEffect(() => {
    let mounted = true;
    setCheckingAuth(true);

    const checkToken = getStoredToken();
    if (checkToken) {
      api.me()
        .then((user) => {
          if (mounted) setCurrentUser(user);
        })
        .catch(() => {
          setStoredToken(null);
          return api.login({ email: "user@bhashalens.org", password: "DemoUser123!" })
            .then((res) => {
              if (mounted) {
                setStoredToken(res.token);
                setCurrentUser(res.user);
              }
            });
        })
        .finally(() => {
          if (mounted) setCheckingAuth(false);
        });
    } else {
      api.login({ email: "user@bhashalens.org", password: "DemoUser123!" })
        .then((res) => {
          if (mounted) {
            setStoredToken(res.token);
            setCurrentUser(res.user);
          }
        })
        .catch(() => {})
        .finally(() => {
          if (mounted) setCheckingAuth(false);
        });
    }

    return () => {
      mounted = false;
    };
  }, []);

  // 1-Click Quick Switcher for Judges / Evaluators
  const handleQuickDemoLogin = async (role: "user" | "admin") => {
    try {
      const email = role === "admin" ? "admin@bhashalens.org" : "user@bhashalens.org";
      const password = role === "admin" ? "AdminPass123!" : "DemoUser123!";
      const res = await api.login({ email, password });
      setStoredToken(res.token);
      setCurrentUser(res.user);
      setAuthModalMode(null);

      if (role === "admin") {
        navigateTo("/admin");
      } else {
        navigateTo("/app");
      }
    } catch {
      setAuthModalMode(role === "admin" ? "admin_login" : "login");
    }
  };

  const handlePortalSwitch = (targetPortal: "user" | "admin") => {
    if (targetPortal === "admin") {
      if (currentUser?.role === "ADMIN" || currentUser?.role === "REVIEWER") {
        navigateTo("/admin");
      } else {
        navigateTo("/admin/login");
      }
    } else {
      navigateTo("/app");
    }
  };

  // ── Analytical Data Fetching (Preserved) ───────────────────────────────────

  const { data: districtsData } = useAsync(() => api.districts(), []);
  const districts = districtsData?.districts ?? [];

  const { data: summaryData, loading: summaryLoading } = useAsync(
    useCallback(() => api.summary(thresholds), [thresholds]),
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

  const {
    data: communityStatsData,
    loading: communityStatsLoading,
    refetch: refetchCommunityStats,
  } = useAsync(
    useCallback(() => api.communityStats(), []),
    []
  );

  // ── Analytical Handlers (Preserved) ────────────────────────────────────────

  const handleCellSelect = (district: string, gender: string, age_group: string) => {
    setSelectedCell({ district, gender, age_group });
    navigateTo("/admin/diagnostics");
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
    navigateTo("/admin/coverage");
  };

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

  // Check if current route requires admin access
  const isAdminRoute = currentPath.startsWith("/admin") && currentPath !== "/admin/login";
  const userHasAdminAccess = currentUser?.role === "ADMIN" || currentUser?.role === "REVIEWER";

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: "#F8FAFC" }}>
      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        * { box-sizing: border-box; }
        button:focus-visible, a:focus-visible, select:focus-visible,
        input:focus-visible, textarea:focus-visible {
          outline: 2px solid #2563EB;
          outline-offset: 2px;
        }
      `}</style>

      {/* ── Global Header ──────────────────────────────────────────────────── */}
      <AppHeader
        currentPortal={currentPortal}
        onSwitchPortal={handlePortalSwitch}
        currentUser={currentUser}
        onLoginRequest={(mode) => setAuthModalMode(mode || "login")}
        onLogout={() => {
          setCurrentUser(null);
          navigateTo("/login");
        }}
        onQuickDemoLogin={handleQuickDemoLogin}
      />

      {/* ── Portal Navigation Sub-tabs ─────────────────────────────────────── */}
      {!checkingAuth && currentPath !== "/login" && currentPath !== "/register" && currentPath !== "/admin/login" && (
        <nav
          aria-label="Portal Navigation"
          style={{ background: "#FFFFFF", borderBottom: "1px solid #E2E8F0" }}
        >
          <div
            style={{
              maxWidth: "1400px",
              margin: "0 auto",
              padding: "0 1.5rem",
              display: "flex",
              overflowX: "auto",
              gap: "0.25rem",
            }}
          >
            {(currentPortal === "admin" && userHasAdminAccess ? ADMIN_TABS : USER_TABS).map((tab) => {
              const isSelected = currentPath === tab.path;
              return (
                <button
                  key={tab.path}
                  type="button"
                  onClick={() => navigateTo(tab.path)}
                  style={{
                    padding: "0.75rem 1.15rem",
                    background: "none",
                    border: "none",
                    borderBottom: isSelected ? "2px solid #2563EB" : "2px solid transparent",
                    color: isSelected ? "#2563EB" : "#64748B",
                    fontWeight: isSelected ? 700 : 500,
                    fontSize: "0.85rem",
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                    transition: "all 0.15s ease",
                  }}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </nav>
      )}

      {/* ── Analytical Ribbon Strips for Admin Analytics ────────────────────── */}
      {currentPortal === "admin" && userHasAdminAccess && currentPath !== "/admin/settings" && (
        <>
          <div style={{ maxWidth: "1400px", margin: "1rem auto 0", padding: "0 1.5rem", width: "100%" }}>
            <CommunityMetricsRibbon stats={communityStatsData ?? null} loading={communityStatsLoading} />
          </div>
          <ThresholdBar value={thresholds} onChange={setThresholds} />
          {currentPath !== "/admin/users" && currentPath !== "/admin/submissions" && (
            <MetricsRibbon stats={summaryData ?? null} loading={summaryLoading} />
          )}
        </>
      )}

      {/* ── Main View Content Area ─────────────────────────────────────────── */}
      <main style={{ maxWidth: "1400px", margin: "0 auto", padding: "1.5rem", flex: 1, width: "100%" }}>
        {checkingAuth ? (
          <LoadingSpinner label="Authenticating session…" />
        ) : (
          <>
            {/* ═══ STANDALONE AUTH PAGES ═══════════════════════════════════════ */}
            {currentPath === "/login" && (
              <div style={{ padding: "2rem 0" }}>
                <AuthModal
                  initialMode="login"
                  isInline
                  onSuccess={(user) => {
                    setCurrentUser(user);
                    navigateTo("/app");
                  }}
                />
              </div>
            )}

            {currentPath === "/register" && (
              <div style={{ padding: "2rem 0" }}>
                <AuthModal
                  initialMode="register"
                  isInline
                  onSuccess={(user) => {
                    setCurrentUser(user);
                    navigateTo("/app");
                  }}
                />
              </div>
            )}

            {currentPath === "/admin/login" && (
              <div style={{ padding: "2rem 0" }}>
                <AuthModal
                  initialMode="admin_login"
                  isInline
                  onSuccess={(user) => {
                    setCurrentUser(user);
                    navigateTo("/admin");
                  }}
                />
              </div>
            )}

            {/* ═══ ADMIN AUTHORIZATION GUARD ══════════════════════════════════ */}
            {isAdminRoute && !userHasAdminAccess && (
              <div
                style={{
                  maxWidth: "600px",
                  margin: "3rem auto",
                  background: "#FFFFFF",
                  border: "1px solid #FECACA",
                  borderRadius: "14px",
                  padding: "2rem",
                  textAlign: "center",
                  boxShadow: "0 4px 6px -1px rgba(0,0,0,0.05)",
                }}
              >
                <div style={{ fontSize: "2.5rem", marginBottom: "0.5rem" }}>🛡️</div>
                <h2 style={{ fontSize: "1.25rem", fontWeight: 700, color: "#991B1B", margin: "0 0 0.5rem" }}>
                  Administrative Authorization Required
                </h2>
                <p style={{ fontSize: "0.88rem", color: "#64748B", margin: "0 0 1.5rem", lineHeight: 1.6 }}>
                  You are currently logged in as a standard contributor. The Administrative Portal requires an <strong>ADMIN</strong> or <strong>REVIEWER</strong> role.
                </p>
                <div style={{ display: "flex", gap: "0.75rem", justifyContent: "center" }}>
                  <button
                    type="button"
                    onClick={() => handleQuickDemoLogin("admin")}
                    style={{
                      background: "#0D9488",
                      color: "#FFFFFF",
                      border: "none",
                      padding: "0.6rem 1.25rem",
                      borderRadius: "8px",
                      fontWeight: 700,
                      fontSize: "0.85rem",
                      cursor: "pointer",
                    }}
                  >
                    Authenticate as Demo Admin →
                  </button>
                  <button
                    type="button"
                    onClick={() => navigateTo("/app")}
                    style={{
                      background: "#F1F5F9",
                      border: "1px solid #CBD5E1",
                      color: "#475569",
                      padding: "0.6rem 1rem",
                      borderRadius: "8px",
                      fontWeight: 600,
                      fontSize: "0.85rem",
                      cursor: "pointer",
                    }}
                  >
                    Return to User Portal
                  </button>
                </div>
              </div>
            )}

            {/* ═══ USER PORTAL ROUTES ══════════════════════════════════════════ */}
            {currentPortal === "user" && (
              <>
                {/* /app — User Dashboard */}
                {currentPath === "/app" && currentUser && (
                  <UserDashboard
                    user={currentUser}
                    onNavigate={navigateTo}
                    onSelectSubmission={(subId) => {
                      setDetailSubmissionId(subId);
                      navigateTo(`/app/submissions/${subId}`);
                    }}
                  />
                )}

                {/* /app/submit — Dedicated AI Input Submission */}
                {currentPath === "/app/submit" && currentUser && (
                  <AiSubmissionPage
                    user={currentUser}
                    onNavigate={navigateTo}
                    onSubmissionComplete={() => {
                      refetchCommunityStats();
                    }}
                  />
                )}

                {/* /app/submissions — User's Submissions History */}
                {currentPath === "/app/submissions" && (
                  <UserSubmissionsHistory
                    onNavigate={navigateTo}
                    onSelectSubmission={(subId) => {
                      setDetailSubmissionId(subId);
                      navigateTo(`/app/submissions/${subId}`);
                    }}
                  />
                )}

                {/* /app/submissions/:id — Individual Submission Details */}
                {(currentPath.startsWith("/app/submissions/") || detailSubmissionId) && (
                  <SubmissionDetailView
                    submissionId={detailSubmissionId || currentPath.split("/").pop() || ""}
                    onBack={() => navigateTo("/app/submissions")}
                  />
                )}

                {/* /app/profile — User Profile */}
                {currentPath === "/app/profile" && currentUser && (
                  <UserProfileView
                    user={currentUser}
                    onNavigate={navigateTo}
                    onLogout={() => {
                      setCurrentUser(null);
                      navigateTo("/login");
                    }}
                  />
                )}
              </>
            )}

            {/* ═══ ADMIN PORTAL ROUTES ═════════════════════════════════════════ */}
            {currentPortal === "admin" && userHasAdminAccess && currentUser && (
              <>
                {/* /admin — Admin Overview */}
                {currentPath === "/admin" && (
                  <AdminDashboard
                    adminUser={currentUser}
                    onNavigate={navigateTo}
                    onSelectSubmission={(subId) => {
                      setDetailSubmissionId(subId);
                      navigateTo(`/app/submissions/${subId}`);
                    }}
                  />
                )}

                {/* /admin/users — User Management */}
                {currentPath === "/admin/users" && (
                  <UserManagement currentUser={currentUser} />
                )}

                {/* /admin/submissions — System Submissions */}
                {currentPath === "/admin/submissions" && (
                  <AdminSubmissionsView
                    onSelectSubmission={(subId) => {
                      setDetailSubmissionId(subId);
                      navigateTo(`/app/submissions/${subId}`);
                    }}
                    onNavigateToReview={() => {
                      navigateTo("/admin/review");
                    }}
                  />
                )}

                {/* /admin/review — Human Review Queue */}
                {currentPath === "/admin/review" && (
                  <section aria-labelledby="heading-review">
                    <ReviewQueue
                      onReviewAction={() => {
                        refetchCommunityStats();
                      }}
                    />
                  </section>
                )}

                {/* /admin/coverage — Coverage Matrix */}
                {currentPath === "/admin/coverage" && (
                  <section aria-labelledby="heading-coverage">
                    <div style={{ marginBottom: "1rem" }}>
                      <h2 style={{ fontSize: "1.2rem", fontWeight: 700, color: "#1F2937", margin: "0 0 0.25rem" }}>
                        Evidence Coverage Matrix
                      </h2>
                      <p style={{ fontSize: "0.82rem", color: "#64748B", margin: 0 }}>
                        District × Gender × Age Group cohort matrix. <strong>No data ≠ 0% WER.</strong> Click any cell to inspect breakdown.
                      </p>
                    </div>

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
                      {coverageError && <ErrorMessage message={coverageError} onRetry={refetchCoverage} />}

                      {!coverageLoading && !coverageError && filteredCoverage && (
                        <div className="bl-card" style={{ padding: "1.25rem" }}>
                          <CoverageMatrix
                            data={filteredCoverage}
                            onCellSelect={handleCellSelect}
                            onWerClick={handleWerClick}
                            selectedCell={selectedCell}
                          />
                        </div>
                      )}
                    </div>

                    {selectedCoverageCell && (
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginTop: "1rem" }}>
                        <div className="bl-card">
                          <ErrorDecomposition cell={selectedCoverageCell} />
                        </div>
                        <div className="bl-card">
                          <h3 style={{ fontSize: "0.9rem", fontWeight: 700, color: "#1F2937", margin: "0 0 0.75rem" }}>
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

                {/* /admin/diagnostics — Diagnostics & WER Chart */}
                {currentPath === "/admin/diagnostics" && (
                  <section aria-labelledby="heading-diagnostics">
                    <div style={{ marginBottom: "1rem" }}>
                      <h2 style={{ fontSize: "1.2rem", fontWeight: 700, color: "#1F2937", margin: "0 0 0.25rem" }}>
                        District Diagnostics &amp; Recognition Chart
                      </h2>
                      <p style={{ fontSize: "0.82rem", color: "#64748B", margin: 0 }}>
                        Aggregate recognition error rates and error decomposition.
                      </p>
                    </div>

                    {overviewLoading && <LoadingSpinner label="Loading district diagnostics…" />}
                    {overviewError && <ErrorMessage message={overviewError} onRetry={refetchOverview} />}

                    {!overviewLoading && !overviewError && overviewData && (
                      <>
                        <div className="bl-card" style={{ marginBottom: "1.25rem" }}>
                          <WerChart
                            data={overviewData}
                            highWerThreshold={thresholds.high_wer_threshold}
                            onBarClick={handleDistrictClick}
                          />
                        </div>

                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: "0.75rem", marginBottom: "1.5rem" }}>
                          {overviewData.map((result: WerResult) => (
                            <DistrictCard
                              key={result.district}
                              result={result}
                              onClick={() => handleDistrictClick(result.district)}
                            />
                          ))}
                        </div>

                        {selectedCoverageCell && (
                          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                            <div className="bl-card">
                              <ErrorDecomposition cell={selectedCoverageCell} />
                            </div>
                            <div className="bl-card">
                              <h3 style={{ fontSize: "0.9rem", fontWeight: 700, color: "#1F2937", margin: "0 0 0.75rem" }}>
                                🔢 Selected Cell Summary
                              </h3>
                              <dl style={{ margin: 0, display: "grid", gridTemplateColumns: "120px 1fr", gap: "0.35rem 1rem", fontSize: "0.82rem" }}>
                                <dt style={{ color: "#64748B" }}>District:</dt>
                                <dd style={{ margin: 0, fontWeight: 600 }}>{selectedCoverageCell.district}</dd>
                                <dt style={{ color: "#64748B" }}>Gender:</dt>
                                <dd style={{ margin: 0, fontWeight: 600 }}>{selectedCoverageCell.gender}</dd>
                                <dt style={{ color: "#64748B" }}>Age Group:</dt>
                                <dd style={{ margin: 0, fontWeight: 600 }}>{selectedCoverageCell.age_group}</dd>
                                <dt style={{ color: "#64748B" }}>Status:</dt>
                                <dd style={{ margin: 0, fontWeight: 600 }}>{selectedCoverageCell.status}</dd>
                                <dt style={{ color: "#64748B" }}>Recordings:</dt>
                                <dd style={{ margin: 0, fontWeight: 600 }}>{selectedCoverageCell.recording_count}</dd>
                                <dt style={{ color: "#64748B" }}>WER %:</dt>
                                <dd style={{ margin: 0, fontWeight: 700 }}>
                                  {selectedCoverageCell.wer_pct !== null ? `${selectedCoverageCell.wer_pct.toFixed(1)}%` : "—"}
                                </dd>
                              </dl>
                              {selectedCoverageCell.wer_pct !== null && (
                                <button
                                  type="button"
                                  onClick={() => handleWerClick(selectedCoverageCell)}
                                  disabled={mathModalLoading}
                                  style={{
                                    marginTop: "1rem",
                                    padding: "0.45rem 0.9rem",
                                    background: "#EFF6FF",
                                    border: "1px solid #BFDBFE",
                                    borderRadius: "6px",
                                    color: "#2563EB",
                                    fontWeight: 600,
                                    fontSize: "0.8rem",
                                    cursor: "pointer",
                                  }}
                                >
                                  {mathModalLoading ? "Loading…" : "🔬 Inspect Mathematical Formula"}
                                </button>
                              )}
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </section>
                )}

                {/* /admin/action-plan — Action Plan & Priorities */}
                {currentPath === "/admin/action-plan" && (
                  <section aria-labelledby="heading-action">
                    <div style={{ marginBottom: "1rem" }}>
                      <h2 style={{ fontSize: "1.2rem", fontWeight: 700, color: "#1F2937", margin: "0 0 0.25rem" }}>
                        Action Plan — Recording Collection Priorities
                      </h2>
                      <p style={{ fontSize: "0.82rem", color: "#64748B", margin: 0 }}>
                        Regional gaps ranked by urgency. Submit community overrides with human sign-off before campaign commissioning.
                      </p>
                    </div>

                    {prioritiesLoading && <LoadingSpinner label="Loading priorities…" />}
                    {prioritiesError && <ErrorMessage message={prioritiesError} onRetry={refetchPriorities} />}

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

                {/* /admin/governance — Datasets & Benchmark Publication */}
                {currentPath === "/admin/governance" && (
                  <section aria-labelledby="heading-governance">
                    <DatasetGovernance
                      onDatasetChanged={() => {
                        refetchCommunityStats();
                      }}
                    />
                  </section>
                )}

                {/* /admin/settings — System Settings */}
                {currentPath === "/admin/settings" && (
                  <AdminSettings
                    thresholds={thresholds}
                    onThresholdsChange={setThresholds}
                    dataTier={dataTier}
                    onDataTierChange={setDataTier}
                  />
                )}
              </>
            )}
          </>
        )}
      </main>

      {/* ── Math Integrity Modal ────────────────────────────────────────────── */}
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
            refetchOverview();
          }}
        />
      )}

      {/* ── Standalone Auth Modal Trigger ───────────────────────────────────── */}
      {authModalMode && (
        <AuthModal
          initialMode={authModalMode}
          onClose={() => setAuthModalMode(null)}
          onSuccess={(user) => {
            setCurrentUser(user);
            setAuthModalMode(null);
            if (user.role === "ADMIN" || user.role === "REVIEWER") {
              navigateTo("/admin");
            } else {
              navigateTo("/app");
            }
          }}
        />
      )}
    </div>
  );
}
