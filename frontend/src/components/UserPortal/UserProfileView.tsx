import { api, setStoredToken } from "../../api/client";
import type { User } from "../../types";

interface UserProfileViewProps {
  user: User;
  onLogout: () => void;
  onNavigate: (route: string) => void;
}

export function UserProfileView({ user, onLogout, onNavigate }: UserProfileViewProps) {
  const handleLogoutClick = async () => {
    try {
      await api.logout();
    } catch {
      // Ignore network errors on logout
    }
    setStoredToken(null);
    onLogout();
  };

  return (
    <div style={{ maxWidth: "680px", margin: "0 auto" }}>
      <div style={{ marginBottom: "1.25rem" }}>
        <button
          type="button"
          onClick={() => onNavigate("/app")}
          style={{
            background: "#FFFFFF",
            border: "1px solid #CBD5E1",
            color: "#475569",
            padding: "0.4rem 0.85rem",
            borderRadius: "6px",
            fontSize: "0.82rem",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          ← Back to Dashboard
        </button>
      </div>

      <div className="bl-card" style={{ padding: "2rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "1.5rem" }}>
          <div
            style={{
              width: "56px",
              height: "56px",
              borderRadius: "50%",
              background: "#EFF6FF",
              border: "1px solid #BFDBFE",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "1.65rem",
            }}
          >
            👤
          </div>
          <div>
            <h1 style={{ fontSize: "1.25rem", fontWeight: 800, color: "#1F2937", margin: "0 0 0.2rem" }}>
              {user.name}
            </h1>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <span style={{ fontSize: "0.85rem", color: "#64748B" }}>{user.email}</span>
              <span className="bl-badge bl-badge-primary" style={{ fontSize: "0.72rem" }}>
                {user.role}
              </span>
            </div>
          </div>
        </div>

        {/* Account Details Box */}
        <div
          style={{
            background: "#F8FAFC",
            border: "1px solid #E2E8F0",
            borderRadius: "10px",
            padding: "1.25rem",
            marginBottom: "1.5rem",
          }}
        >
          <div style={{ fontSize: "0.78rem", fontWeight: 700, color: "#64748B", textTransform: "uppercase", marginBottom: "0.75rem" }}>
            Account Specifications
          </div>

          <dl style={{ margin: 0, display: "grid", gridTemplateColumns: "140px 1fr", gap: "0.6rem 1rem", fontSize: "0.85rem" }}>
            <dt style={{ color: "#64748B", fontWeight: 600 }}>User ID</dt>
            <dd style={{ margin: 0, color: "#1F2937" }}><code>{user.id}</code></dd>

            <dt style={{ color: "#64748B", fontWeight: 600 }}>Account Status</dt>
            <dd style={{ margin: 0 }}>
              <span className="bl-badge bl-badge-success" style={{ fontSize: "0.72rem" }}>Active</span>
            </dd>

            <dt style={{ color: "#64748B", fontWeight: 600 }}>Registered Date</dt>
            <dd style={{ margin: 0, color: "#1F2937" }}>
              {new Date(user.created_at).toLocaleString()}
            </dd>

            <dt style={{ color: "#64748B", fontWeight: 600 }}>Last Login</dt>
            <dd style={{ margin: 0, color: "#1F2937" }}>
              {user.last_login_at ? new Date(user.last_login_at).toLocaleString() : "First active session"}
            </dd>
          </dl>
        </div>

        {/* Privacy Safeguard Note */}
        <div
          style={{
            background: "#F0FDFA",
            border: "1px solid #99F6E4",
            borderRadius: "10px",
            padding: "1.25rem",
            marginBottom: "1.5rem",
          }}
        >
          <div style={{ fontSize: "0.85rem", fontWeight: 700, color: "#0F766E", marginBottom: "0.35rem" }}>
            🛡️ Privacy &amp; Consent Governance
          </div>
          <p style={{ fontSize: "0.8rem", color: "#115E59", lineHeight: 1.55, margin: 0 }}>
            Your account is managed under strict data privacy safeguards. Submissions made under your account remain isolated from public scraping. Each submission grants you a unique Deletion Token allowing immediate right-to-erasure audio deletion.
          </p>
        </div>

        {/* Logout Button */}
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <button
            type="button"
            onClick={handleLogoutClick}
            style={{
              padding: "0.6rem 1.25rem",
              background: "#FEE2E2",
              border: "1px solid #FECACA",
              borderRadius: "8px",
              color: "#DC2626",
              fontWeight: 700,
              fontSize: "0.85rem",
              cursor: "pointer",
            }}
          >
            Sign Out of Account
          </button>
        </div>
      </div>
    </div>
  );
}
