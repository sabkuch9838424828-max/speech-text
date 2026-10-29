import { useEffect, useState } from "react";
import { api } from "../../api/client";
import type { User, UserRole } from "../../types";

interface UserManagementProps {
  currentUser: User;
}

export function UserManagement({ currentUser }: UserManagementProps) {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");

  // Role edit modal
  const [editingRoleUser, setEditingRoleUser] = useState<User | null>(null);
  const [selectedNewRole, setSelectedNewRole] = useState<UserRole>("USER");
  const [updating, setUpdating] = useState(false);

  const fetchUsers = () => {
    setLoading(true);
    setError(null);
    api.adminUsers({
      search: searchTerm.trim() || undefined,
      role: roleFilter || undefined,
      is_active: statusFilter === "" ? undefined : statusFilter === "active",
      limit: 100,
    })
      .then((res) => setUsers(res.users))
      .catch((err) => setError(err.message || "Failed to load users."))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchUsers();
  }, [roleFilter, statusFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchUsers();
  };

  const handleToggleStatus = async (user: User) => {
    const nextStatus = !user.is_active;
    const confirmMsg = nextStatus
      ? `Re-activate account for ${user.name} (${user.email})?`
      : `Disable account for ${user.name} (${user.email})? Active sessions will be terminated.`;

    if (!confirm(confirmMsg)) return;

    try {
      await api.adminUpdateUserStatus(user.id, nextStatus);
      setSuccessMsg(`Status updated for ${user.name}.`);
      setUsers((prev) =>
        prev.map((u) => (u.id === user.id ? { ...u, is_active: nextStatus } : u))
      );
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to update user status.");
    }
  };

  const handleConfirmRoleChange = async () => {
    if (!editingRoleUser) return;
    setUpdating(true);
    setError(null);
    try {
      await api.adminUpdateUserRole(editingRoleUser.id, selectedNewRole);
      setSuccessMsg(`Role for ${editingRoleUser.name} updated to ${selectedNewRole}.`);
      setUsers((prev) =>
        prev.map((u) => (u.id === editingRoleUser.id ? { ...u, role: selectedNewRole } : u))
      );
      setEditingRoleUser(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to update role.");
    } finally {
      setUpdating(false);
    }
  };

  return (
    <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
      {/* Title */}
      <div style={{ marginBottom: "1.5rem" }}>
        <h1 style={{ fontSize: "1.35rem", fontWeight: 800, color: "#1F2937", margin: "0 0 0.35rem" }}>
          👥 Registered User Management
        </h1>
        <p style={{ fontSize: "0.85rem", color: "#64748B", margin: 0 }}>
          Manage contributor, reviewer, and administrator roles. Control access credentials and account statuses.
        </p>
      </div>

      {/* Success Banner */}
      {successMsg && (
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
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span>✓ {successMsg}</span>
          <button
            type="button"
            onClick={() => setSuccessMsg(null)}
            style={{ background: "none", border: "none", color: "#065F46", cursor: "pointer", fontWeight: 700 }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Error Banner */}
      {error && (
        <div
          role="alert"
          style={{
            background: "#FEF2F2",
            border: "1px solid #FECACA",
            color: "#DC2626",
            padding: "0.75rem 1rem",
            borderRadius: "8px",
            fontSize: "0.82rem",
            marginBottom: "1rem",
          }}
        >
          ⚠️ {error}
        </div>
      )}

      {/* Filter / Search Strip */}
      <div
        className="bl-card"
        style={{
          padding: "1rem 1.25rem",
          marginBottom: "1.5rem",
          display: "flex",
          gap: "1rem",
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        <form onSubmit={handleSearchSubmit} style={{ flex: "1 1 240px", display: "flex", gap: "0.5rem" }}>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by user name or email…"
            style={{ width: "100%", boxSizing: "border-box" }}
          />
          <button
            type="submit"
            style={{
              padding: "0.5rem 0.85rem",
              background: "#2563EB",
              color: "#FFFFFF",
              border: "none",
              borderRadius: "8px",
              fontWeight: 600,
              fontSize: "0.82rem",
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            Search
          </button>
        </form>

        <div style={{ minWidth: "150px" }}>
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            style={{ width: "100%" }}
          >
            <option value="">All Roles</option>
            <option value="USER">USER (Contributor)</option>
            <option value="REVIEWER">REVIEWER</option>
            <option value="ADMIN">ADMIN (Lead)</option>
          </select>
        </div>

        <div style={{ minWidth: "150px" }}>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{ width: "100%" }}
          >
            <option value="">All Account Statuses</option>
            <option value="active">Active Only</option>
            <option value="disabled">Disabled Only</option>
          </select>
        </div>

        {(searchTerm || roleFilter || statusFilter) && (
          <button
            type="button"
            onClick={() => {
              setSearchTerm("");
              setRoleFilter("");
              setStatusFilter("");
              fetchUsers();
            }}
            style={{
              background: "#F1F5F9",
              border: "1px solid #CBD5E1",
              borderRadius: "6px",
              padding: "0.5rem 0.85rem",
              fontSize: "0.82rem",
              color: "#475569",
              cursor: "pointer",
            }}
          >
            Reset
          </button>
        )}
      </div>

      {/* User Table */}
      <div className="bl-card" style={{ padding: 0, overflow: "hidden" }}>
        {loading ? (
          <div style={{ padding: "3rem", textAlign: "center", color: "#64748B" }}>
            Loading registered users…
          </div>
        ) : users.length === 0 ? (
          <div style={{ padding: "3rem", textAlign: "center" }}>
            <div style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>👥</div>
            <p style={{ fontWeight: 600, color: "#1F2937", margin: 0 }}>No users match the criteria.</p>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ margin: 0, border: "none" }}>
              <thead>
                <tr>
                  <th>User ID</th>
                  <th>Name &amp; Email</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Registered</th>
                  <th>Last Login</th>
                  <th style={{ textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => {
                  const isCurrent = u.id === currentUser.id;
                  return (
                    <tr key={u.id}>
                      <td>
                        <code style={{ fontSize: "0.78rem" }}>{u.id}</code>
                      </td>
                      <td>
                        <div style={{ fontWeight: 700, color: "#1F2937" }}>
                          {u.name}
                          {isCurrent && (
                            <span style={{ fontSize: "0.7rem", color: "#2563EB", marginLeft: "0.35rem" }}>
                              (You)
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: "0.78rem", color: "#64748B" }}>{u.email}</div>
                      </td>
                      <td>
                        <span
                          className={`bl-badge ${
                            u.role === "ADMIN"
                              ? "bl-badge-danger"
                              : u.role === "REVIEWER"
                              ? "bl-badge-secondary"
                              : "bl-badge-primary"
                          }`}
                        >
                          {u.role}
                        </span>
                      </td>
                      <td>
                        <span
                          className={`bl-badge ${u.is_active ? "bl-badge-success" : "bl-badge-neutral"}`}
                        >
                          {u.is_active ? "Active" : "Disabled"}
                        </span>
                      </td>
                      <td style={{ fontSize: "0.78rem", color: "#64748B", whiteSpace: "nowrap" }}>
                        {new Date(u.created_at).toLocaleDateString()}
                      </td>
                      <td style={{ fontSize: "0.78rem", color: "#64748B", whiteSpace: "nowrap" }}>
                        {u.last_login_at ? new Date(u.last_login_at).toLocaleDateString() : "Never"}
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <div style={{ display: "inline-flex", gap: "0.4rem" }}>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingRoleUser(u);
                              setSelectedNewRole(u.role);
                            }}
                            style={{
                              background: "#EFF6FF",
                              border: "1px solid #BFDBFE",
                              color: "#2563EB",
                              padding: "0.3rem 0.65rem",
                              borderRadius: "4px",
                              fontSize: "0.75rem",
                              fontWeight: 600,
                              cursor: "pointer",
                            }}
                          >
                            Edit Role
                          </button>

                          <button
                            type="button"
                            onClick={() => handleToggleStatus(u)}
                            disabled={isCurrent && u.is_active}
                            style={{
                              background: u.is_active ? "#FEE2E2" : "#ECFDF5",
                              border: `1px solid ${u.is_active ? "#FECACA" : "#A7F3D0"}`,
                              color: u.is_active ? "#DC2626" : "#059669",
                              padding: "0.3rem 0.65rem",
                              borderRadius: "4px",
                              fontSize: "0.75rem",
                              fontWeight: 600,
                              cursor: isCurrent && u.is_active ? "not-allowed" : "pointer",
                            }}
                          >
                            {u.is_active ? "Disable" : "Activate"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Role Modification Modal */}
      {editingRoleUser && (
        <div className="bl-modal-backdrop">
          <div className="bl-modal-content" style={{ padding: "1.75rem", maxWidth: "460px" }}>
            <h3 style={{ fontSize: "1.15rem", fontWeight: 700, color: "#1F2937", margin: "0 0 0.5rem" }}>
              Assign Role for {editingRoleUser.name}
            </h3>
            <p style={{ fontSize: "0.82rem", color: "#64748B", margin: "0 0 1.25rem" }}>
              Email: <strong>{editingRoleUser.email}</strong>. Role upgrades grant privileged administrative access.
            </p>

            <div style={{ marginBottom: "1.25rem" }}>
              <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 600, color: "#374151", marginBottom: "0.35rem" }}>
                Select Role:
              </label>
              <select
                value={selectedNewRole}
                onChange={(e) => setSelectedNewRole(e.target.value as UserRole)}
                style={{ width: "100%" }}
              >
                <option value="USER">USER — Regular speech contributor</option>
                <option value="REVIEWER">REVIEWER — Linguist review queue access</option>
                <option value="ADMIN">ADMIN — Full system governance &amp; dataset publishing</option>
              </select>
            </div>

            <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end" }}>
              <button
                type="button"
                onClick={() => setEditingRoleUser(null)}
                style={{
                  padding: "0.5rem 1rem",
                  background: "#F1F5F9",
                  border: "1px solid #CBD5E1",
                  borderRadius: "6px",
                  fontSize: "0.82rem",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmRoleChange}
                disabled={updating}
                style={{
                  padding: "0.5rem 1.25rem",
                  background: "#2563EB",
                  color: "#FFFFFF",
                  border: "none",
                  borderRadius: "6px",
                  fontSize: "0.82rem",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                {updating ? "Saving…" : "Save Role Assignment"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
