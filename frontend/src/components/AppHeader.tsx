import { api, setStoredToken } from "../api/client";
import type { User } from "../types";

interface AppHeaderProps {
  currentPortal: "user" | "admin";
  onSwitchPortal: (portal: "user" | "admin") => void;
  currentUser: User | null;
  onLoginRequest: (mode?: "login" | "admin_login") => void;
  onLogout: () => void;
  onQuickDemoLogin: (role: "user" | "admin") => void;
}

export function AppHeader({
  currentPortal,
  onSwitchPortal,
  currentUser,
  onLoginRequest,
  onLogout,
  onQuickDemoLogin,
}: AppHeaderProps) {
  const handleLogout = async () => {
    try {
      await api.logout();
    } catch {
      // Ignore
    }
    setStoredToken(null);
    onLogout();
  };

  return (
    <header className="bl-navbar">
      {/* Demo helper bar at the very top for judges and evaluators */}
      <div
        style={{
          background: "#F1F5F9",
          borderBottom: "1px solid #E2E8F0",
          padding: "0.3rem 1.5rem",
          fontSize: "0.75rem",
          color: "#475569",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "0.5rem",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <span style={{ fontWeight: 700, color: "#1E40AF" }}>⚡ Competition Evaluator Quick-Access:</span>
          <span style={{ color: "#64748B" }}>Switch accounts in one click to evaluate both portals</span>
        </div>

        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
          <button
            type="button"
            onClick={() => onQuickDemoLogin("user")}
            style={{
              padding: "0.2rem 0.6rem",
              background: currentUser?.role === "USER" ? "#EFF6FF" : "#FFFFFF",
              border: `1px solid ${currentUser?.role === "USER" ? "#3B82F6" : "#CBD5E1"}`,
              borderRadius: "4px",
              color: currentUser?.role === "USER" ? "#1D4ED8" : "#334155",
              fontSize: "0.72rem",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            👤 Demo User (user@bhashalens.org)
          </button>

          <button
            type="button"
            onClick={() => onQuickDemoLogin("admin")}
            style={{
              padding: "0.2rem 0.6rem",
              background: currentUser?.role === "ADMIN" ? "#F0FDFA" : "#FFFFFF",
              border: `1px solid ${currentUser?.role === "ADMIN" ? "#0D9488" : "#CBD5E1"}`,
              borderRadius: "4px",
              color: currentUser?.role === "ADMIN" ? "#0F766E" : "#334155",
              fontSize: "0.72rem",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            🛡️ Demo Admin (admin@bhashalens.org)
          </button>
        </div>
      </div>

      {/* Main navigation row */}
      <div
        style={{
          maxWidth: "1400px",
          margin: "0 auto",
          padding: "0.85rem 1.5rem",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "1rem",
        }}
      >
        {/* Brand identity */}
        <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
          <div
            onClick={() => onSwitchPortal(currentPortal)}
            style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: "0.6rem" }}
          >
            <div
              style={{
                width: "36px",
                height: "36px",
                borderRadius: "10px",
                background: "linear-gradient(135deg, #2563EB 0%, #0D9488 100%)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#FFFFFF",
                fontSize: "1.2rem",
                boxShadow: "0 2px 4px rgba(37, 99, 235, 0.2)",
              }}
            >
              🌐
            </div>
            <div>
              <div style={{ fontSize: "1.2rem", fontWeight: 800, color: "#1F2937", letterSpacing: "-0.02em", lineHeight: 1.1 }}>
                BhashaLens
              </div>
              <div style={{ fontSize: "0.72rem", color: "#64748B", fontWeight: 500 }}>
                Calm Speech Benchmark &amp; Governance
              </div>
            </div>
          </div>

          {/* Portal Switcher Segmented Control */}
          <div
            style={{
              display: "inline-flex",
              background: "#F1F5F9",
              borderRadius: "8px",
              padding: "0.2rem",
              marginLeft: "1rem",
            }}
          >
            <button
              type="button"
              onClick={() => onSwitchPortal("user")}
              style={{
                padding: "0.35rem 0.85rem",
                borderRadius: "6px",
                border: "none",
                background: currentPortal === "user" ? "#FFFFFF" : "transparent",
                color: currentPortal === "user" ? "#2563EB" : "#64748B",
                fontWeight: currentPortal === "user" ? 700 : 500,
                fontSize: "0.82rem",
                boxShadow: currentPortal === "user" ? "0 1px 2px rgba(0,0,0,0.06)" : "none",
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
            >
              👤 User Portal
            </button>

            <button
              type="button"
              onClick={() => onSwitchPortal("admin")}
              style={{
                padding: "0.35rem 0.85rem",
                borderRadius: "6px",
                border: "none",
                background: currentPortal === "admin" ? "#FFFFFF" : "transparent",
                color: currentPortal === "admin" ? "#0D9488" : "#64748B",
                fontWeight: currentPortal === "admin" ? 700 : 500,
                fontSize: "0.82rem",
                boxShadow: currentPortal === "admin" ? "0 1px 2px rgba(0,0,0,0.06)" : "none",
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
            >
              🛡️ Admin Portal
            </button>
          </div>
        </div>

        {/* User Session Area */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          {currentUser ? (
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: "0.85rem", fontWeight: 700, color: "#1F2937" }}>
                  {currentUser.name}
                </div>
                <div style={{ fontSize: "0.72rem", color: "#64748B" }}>
                  {currentUser.email}
                </div>
              </div>

              <span
                className={`bl-badge ${
                  currentUser.role === "ADMIN"
                    ? "bl-badge-danger"
                    : currentUser.role === "REVIEWER"
                    ? "bl-badge-secondary"
                    : "bl-badge-primary"
                }`}
              >
                {currentUser.role}
              </span>

              <button
                type="button"
                onClick={handleLogout}
                style={{
                  background: "#F8FAFC",
                  border: "1px solid #CBD5E1",
                  color: "#475569",
                  padding: "0.4rem 0.75rem",
                  borderRadius: "6px",
                  fontSize: "0.78rem",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Sign Out
              </button>
            </div>
          ) : (
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <button
                type="button"
                onClick={() => onLoginRequest("login")}
                style={{
                  background: "#FFFFFF",
                  border: "1px solid #CBD5E1",
                  color: "#334155",
                  padding: "0.45rem 0.9rem",
                  borderRadius: "6px",
                  fontSize: "0.82rem",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                User Login
              </button>

              <button
                type="button"
                onClick={() => onLoginRequest("admin_login")}
                style={{
                  background: "#0D9488",
                  color: "#FFFFFF",
                  border: "none",
                  padding: "0.45rem 0.9rem",
                  borderRadius: "6px",
                  fontSize: "0.82rem",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                Admin Login
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
