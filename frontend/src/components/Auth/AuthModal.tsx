import React, { useState } from "react";
import { api, setStoredToken } from "../../api/client";
import type { User } from "../../types";

interface AuthModalProps {
  initialMode?: "login" | "register" | "admin_login";
  onSuccess: (user: User) => void;
  onClose?: () => void;
  isInline?: boolean;
}

export function AuthModal({
  initialMode = "login",
  onSuccess,
  onClose,
  isInline = false,
}: AuthModalProps) {
  const [mode, setMode] = useState<"login" | "register" | "admin_login">(initialMode);
  const [email, setEmail] = useState(
    initialMode === "admin_login" ? "admin@bhashalens.org" : "user@bhashalens.org"
  );
  const [password, setPassword] = useState(
    initialMode === "admin_login" ? "AdminPass123!" : "DemoUser123!"
  );
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const switchMode = (newMode: "login" | "register" | "admin_login") => {
    setMode(newMode);
    setError(null);
    if (newMode === "admin_login") {
      setEmail("admin@bhashalens.org");
      setPassword("AdminPass123!");
    } else if (newMode === "login") {
      setEmail("user@bhashalens.org");
      setPassword("DemoUser123!");
    } else {
      setEmail("");
      setPassword("");
      setName("");
    }
  };

  const fillDemoUser = () => {
    setMode("login");
    setEmail("user@bhashalens.org");
    setPassword("DemoUser123!");
    setError(null);
  };

  const fillDemoAdmin = () => {
    setMode("admin_login");
    setEmail("admin@bhashalens.org");
    setPassword("AdminPass123!");
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (mode === "register") {
        if (!name.trim()) {
          throw new Error("Full name is required.");
        }
        if (password.length < 8) {
          throw new Error("Password must be at least 8 characters long.");
        }
        const res = await api.register({
          name: name.trim(),
          email: email.trim(),
          password,
        });
        setStoredToken(res.token);
        onSuccess(res.user);
      } else {
        const res = await api.login({
          email: email.trim(),
          password,
        });

        if (mode === "admin_login" && res.user.role !== "ADMIN" && res.user.role !== "REVIEWER") {
          throw new Error("Access restricted: This account does not possess administrative privileges.");
        }

        setStoredToken(res.token);
        onSuccess(res.user);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Authentication failed.");
    } finally {
      setLoading(false);
    }
  };

  const content = (
    <div
      style={{
        background: "#FFFFFF",
        borderRadius: "14px",
        padding: "2rem",
        border: "1px solid #E2E8F0",
        boxShadow: isInline ? "0 4px 6px -1px rgba(0, 0, 0, 0.05)" : "0 20px 25px -5px rgba(0, 0, 0, 0.1)",
        width: "100%",
        maxWidth: "460px",
        margin: "0 auto",
      }}
    >
      {/* Header */}
      <div style={{ textAlign: "center", marginBottom: "1.5rem" }}>
        <div style={{ fontSize: "2rem", marginBottom: "0.25rem" }}>
          {mode === "admin_login" ? "🛡️" : "🌐"}
        </div>
        <h2 style={{ fontSize: "1.35rem", fontWeight: 800, color: "#1F2937", margin: "0 0 0.35rem" }}>
          {mode === "register"
            ? "Create Contributor Account"
            : mode === "admin_login"
            ? "Administrator Authentication"
            : "Sign in to BhashaLens"}
        </h2>
        <p style={{ fontSize: "0.85rem", color: "#64748B", margin: 0 }}>
          {mode === "register"
            ? "Submit regional voice samples and monitor verification"
            : mode === "admin_login"
            ? "Secured area for linguists, reviewers, and governance leads"
            : "Access your contributor dashboard and speech records"}
        </p>
      </div>

      {/* Demo Credentials Quick-Select Pill Box */}
      <div
        style={{
          background: "#F8FAFC",
          border: "1px dashed #CBD5E1",
          borderRadius: "10px",
          padding: "0.75rem",
          marginBottom: "1.25rem",
        }}
      >
        <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "#475569", marginBottom: "0.4rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>
          ⚡ Competition Demo Quick-Fill:
        </div>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button
            type="button"
            onClick={fillDemoUser}
            style={{
              flex: 1,
              padding: "0.4rem 0.6rem",
              background: mode === "login" && email === "user@bhashalens.org" ? "#EFF6FF" : "#FFFFFF",
              border: `1px solid ${mode === "login" && email === "user@bhashalens.org" ? "#3B82F6" : "#E2E8F0"}`,
              borderRadius: "6px",
              color: mode === "login" && email === "user@bhashalens.org" ? "#1D4ED8" : "#334155",
              fontSize: "0.78rem",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            👤 Demo User
          </button>
          <button
            type="button"
            onClick={fillDemoAdmin}
            style={{
              flex: 1,
              padding: "0.4rem 0.6rem",
              background: mode === "admin_login" ? "#F0FDFA" : "#FFFFFF",
              border: `1px solid ${mode === "admin_login" ? "#0D9488" : "#E2E8F0"}`,
              borderRadius: "6px",
              color: mode === "admin_login" ? "#0F766E" : "#334155",
              fontSize: "0.78rem",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            🛡️ Demo Admin
          </button>
        </div>
      </div>

      {/* Error alert */}
      {error && (
        <div
          role="alert"
          style={{
            background: "#FEF2F2",
            border: "1px solid #FECACA",
            color: "#DC2626",
            borderRadius: "8px",
            padding: "0.65rem 0.85rem",
            fontSize: "0.82rem",
            marginBottom: "1rem",
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
          }}
        >
          <span>⚠️</span>
          <span>{error}</span>
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit}>
        {mode === "register" && (
          <div style={{ marginBottom: "1rem" }}>
            <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 600, color: "#374151", marginBottom: "0.35rem" }}>
              Full Name
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Priyanshu Sharma"
              style={{ width: "100%", padding: "0.55rem 0.75rem", boxSizing: "border-box" }}
            />
          </div>
        )}

        <div style={{ marginBottom: "1rem" }}>
          <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 600, color: "#374151", marginBottom: "0.35rem" }}>
            Email Address
          </label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="name@example.org"
            style={{ width: "100%", padding: "0.55rem 0.75rem", boxSizing: "border-box" }}
          />
        </div>

        <div style={{ marginBottom: "1.25rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.35rem" }}>
            <label style={{ fontSize: "0.82rem", fontWeight: 600, color: "#374151" }}>
              Password
            </label>
            {mode === "register" && (
              <span style={{ fontSize: "0.72rem", color: "#64748B" }}>Min. 8 characters</span>
            )}
          </div>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••••••"
            style={{ width: "100%", padding: "0.55rem 0.75rem", boxSizing: "border-box" }}
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          style={{
            width: "100%",
            padding: "0.7rem",
            background: mode === "admin_login" ? "#0D9488" : "#2563EB",
            color: "#FFFFFF",
            border: "none",
            borderRadius: "8px",
            fontSize: "0.95rem",
            fontWeight: 700,
            cursor: loading ? "wait" : "pointer",
            boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
          }}
        >
          {loading ? "Verifying..." : mode === "register" ? "Create Free Account" : mode === "admin_login" ? "Authenticate as Admin" : "Sign In to Portal"}
        </button>
      </form>

      {/* Switchers */}
      <div style={{ marginTop: "1.25rem", paddingTop: "1rem", borderTop: "1px solid #E2E8F0", textAlign: "center", fontSize: "0.82rem", color: "#64748B" }}>
        {mode === "login" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            <div>
              Don't have an account?{" "}
              <button
                type="button"
                onClick={() => switchMode("register")}
                style={{ background: "none", border: "none", color: "#2563EB", fontWeight: 700, padding: 0 }}
              >
                Register now
              </button>
            </div>
            <div>
              Are you an administrator?{" "}
              <button
                type="button"
                onClick={() => switchMode("admin_login")}
                style={{ background: "none", border: "none", color: "#0D9488", fontWeight: 700, padding: 0 }}
              >
                Admin Sign In →
              </button>
            </div>
          </div>
        )}

        {mode === "register" && (
          <div>
            Already registered?{" "}
            <button
              type="button"
              onClick={() => switchMode("login")}
              style={{ background: "none", border: "none", color: "#2563EB", fontWeight: 700, padding: 0 }}
            >
              Sign in to your account
            </button>
          </div>
        )}

        {mode === "admin_login" && (
          <div>
            Looking for contributor portal?{" "}
            <button
              type="button"
              onClick={() => switchMode("login")}
              style={{ background: "none", border: "none", color: "#2563EB", fontWeight: 700, padding: 0 }}
            >
              ← Regular User Sign In
            </button>
          </div>
        )}
      </div>

      {onClose && (
        <div style={{ textAlign: "center", marginTop: "1rem" }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              color: "#94A3B8",
              fontSize: "0.78rem",
              cursor: "pointer",
            }}
          >
            Cancel and Return
          </button>
        </div>
      )}
    </div>
  );

  if (isInline) {
    return content;
  }

  return (
    <div className="bl-modal-backdrop">
      {content}
    </div>
  );
}
