import { useState } from "react";
import type { CollectionPriority, OverrideRequest, Thresholds } from "../types";
import { api } from "../api/client";

interface OverrideDrawerProps {
  priority: CollectionPriority;
  thresholds: Thresholds;
  onClose: () => void;
  onSubmitSuccess?: () => void;
}

const QUALITATIVE_TAGS = [
  "Access Barrier",
  "Seasonal Availability",
  "Language Variant",
  "Equipment Issue",
  "Community Agreement",
  "Low Priority",
  "High Priority Override",
  "Other",
];

export function OverrideDrawer({ priority, thresholds, onClose, onSubmitSuccess }: OverrideDrawerProps) {
  const [form, setForm] = useState({
    custom_target: priority.recommended_target,
    qualitative_tag: "",
    notes: "",
    reviewer_name: "",
    reviewer_role: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cellId = `${priority.district}|${priority.gender}|${priority.age_group}`;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.reviewer_name.trim()) {
      setError("Reviewer name is required.");
      return;
    }
    if (!form.qualitative_tag) {
      setError("Please select a qualitative tag.");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const payload: OverrideRequest = {
        cell_id: cellId,
        custom_target: form.custom_target,
        qualitative_tag: form.qualitative_tag,
        notes: form.notes,
        reviewer_name: form.reviewer_name,
        reviewer_role: form.reviewer_role,
      };
      await api.submitOverride(payload);
      setSubmitted(true);
      onSubmitSuccess?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Submission failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        aria-hidden="true"
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.4)",
          zIndex: 40,
        }}
      />

      {/* Drawer */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="drawer-title"
        style={{
          position: "fixed",
          top: 0,
          right: 0,
          bottom: 0,
          zIndex: 50,
          width: "min(420px, 100vw)",
          background: "#fff",
          boxShadow: "-4px 0 24px rgba(0,0,0,0.15)",
          display: "flex",
          flexDirection: "column",
          overflowY: "auto",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "1rem 1.25rem",
            borderBottom: "1px solid #e5e7eb",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            background: "#fafafa",
          }}
        >
          <div>
            <h2 id="drawer-title" style={{ margin: 0, fontSize: "1rem", fontWeight: 800, color: "#1f2937" }}>
              📋 Community Review
            </h2>
            <p style={{ margin: "0.1rem 0 0", fontSize: "0.75rem", color: "#6b7280" }}>
              Override collection recommendation
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close drawer"
            style={{
              background: "none",
              border: "none",
              fontSize: "1.4rem",
              cursor: "pointer",
              color: "#9ca3af",
              lineHeight: 1,
            }}
          >
            ×
          </button>
        </div>

        <div style={{ padding: "1.25rem", flex: 1 }}>
          {/* Priority summary */}
          <div
            style={{
              background: "#f0f9ff",
              border: "1px solid #bae6fd",
              borderRadius: "0.75rem",
              padding: "0.75rem 1rem",
              marginBottom: "1rem",
              fontSize: "0.8rem",
            }}
          >
            <div style={{ fontWeight: 700, color: "#0369a1", marginBottom: "0.3rem" }}>
              #{priority.rank} — {priority.district} · {priority.gender} · {priority.age_group}
            </div>
            <div style={{ color: "#0369a1" }}>{priority.reason}</div>
            <div style={{ marginTop: "0.4rem", color: "#475569" }}>
              Current: {priority.recording_count} recordings · Target: {priority.recommended_target}
            </div>
          </div>

          {submitted ? (
            <div
              role="status"
              style={{
                background: "#ecfdf5",
                border: "1px solid #6ee7b7",
                borderRadius: "0.75rem",
                padding: "1.5rem",
                textAlign: "center",
              }}
            >
              <div style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>✅</div>
              <p style={{ fontWeight: 700, color: "#065f46", margin: "0 0 0.5rem" }}>
                Override Submitted
              </p>
              <p style={{ fontSize: "0.8rem", color: "#059669", margin: 0 }}>
                This recommendation will be reviewed by the field team before any action is taken.
              </p>
              <button
                onClick={onClose}
                style={{
                  marginTop: "1rem",
                  padding: "0.5rem 1.25rem",
                  background: "#059669",
                  color: "#fff",
                  border: "none",
                  borderRadius: "0.5rem",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                Close
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} noValidate>
              {error && (
                <div
                  role="alert"
                  style={{
                    background: "#fef2f2",
                    border: "1px solid #fca5a5",
                    borderRadius: "0.5rem",
                    padding: "0.5rem 0.75rem",
                    color: "#dc2626",
                    fontSize: "0.8rem",
                    marginBottom: "0.75rem",
                  }}
                >
                  {error}
                </div>
              )}

              {/* Custom target */}
              <div style={{ marginBottom: "0.75rem" }}>
                <label
                  htmlFor="custom-target"
                  style={{ display: "block", fontSize: "0.78rem", fontWeight: 600, color: "#374151", marginBottom: "0.3rem" }}
                >
                  Revised Recording Target
                </label>
                <input
                  id="custom-target"
                  type="number"
                  min={0}
                  value={form.custom_target}
                  onChange={(e) => setForm((f) => ({ ...f, custom_target: Number(e.target.value) }))}
                  style={{
                    width: "100%",
                    padding: "0.5rem 0.75rem",
                    border: "1px solid #d1d5db",
                    borderRadius: "0.5rem",
                    fontSize: "0.875rem",
                  }}
                />
              </div>

              {/* Qualitative tag */}
              <div style={{ marginBottom: "0.75rem" }}>
                <label
                  htmlFor="qual-tag"
                  style={{ display: "block", fontSize: "0.78rem", fontWeight: 600, color: "#374151", marginBottom: "0.3rem" }}
                >
                  Tag <span style={{ color: "#ef4444" }}>*</span>
                </label>
                <select
                  id="qual-tag"
                  value={form.qualitative_tag}
                  onChange={(e) => setForm((f) => ({ ...f, qualitative_tag: e.target.value }))}
                  required
                  style={{
                    width: "100%",
                    padding: "0.5rem 0.75rem",
                    border: "1px solid #d1d5db",
                    borderRadius: "0.5rem",
                    fontSize: "0.875rem",
                    background: "#fff",
                  }}
                >
                  <option value="">Select a tag…</option>
                  {QUALITATIVE_TAGS.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>

              {/* Notes */}
              <div style={{ marginBottom: "0.75rem" }}>
                <label
                  htmlFor="notes"
                  style={{ display: "block", fontSize: "0.78rem", fontWeight: 600, color: "#374151", marginBottom: "0.3rem" }}
                >
                  Notes
                </label>
                <textarea
                  id="notes"
                  value={form.notes}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                  rows={3}
                  placeholder="Provide context for this override…"
                  style={{
                    width: "100%",
                    padding: "0.5rem 0.75rem",
                    border: "1px solid #d1d5db",
                    borderRadius: "0.5rem",
                    fontSize: "0.875rem",
                    resize: "vertical",
                  }}
                />
              </div>

              {/* Reviewer */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem", marginBottom: "1rem" }}>
                <div>
                  <label
                    htmlFor="rev-name"
                    style={{ display: "block", fontSize: "0.78rem", fontWeight: 600, color: "#374151", marginBottom: "0.3rem" }}
                  >
                    Reviewer Name <span style={{ color: "#ef4444" }}>*</span>
                  </label>
                  <input
                    id="rev-name"
                    type="text"
                    value={form.reviewer_name}
                    onChange={(e) => setForm((f) => ({ ...f, reviewer_name: e.target.value }))}
                    required
                    placeholder="Your name"
                    style={{
                      width: "100%",
                      padding: "0.5rem 0.75rem",
                      border: "1px solid #d1d5db",
                      borderRadius: "0.5rem",
                      fontSize: "0.875rem",
                    }}
                  />
                </div>
                <div>
                  <label
                    htmlFor="rev-role"
                    style={{ display: "block", fontSize: "0.78rem", fontWeight: 600, color: "#374151", marginBottom: "0.3rem" }}
                  >
                    Role
                  </label>
                  <input
                    id="rev-role"
                    type="text"
                    value={form.reviewer_role}
                    onChange={(e) => setForm((f) => ({ ...f, reviewer_role: e.target.value }))}
                    placeholder="e.g. Field Lead"
                    style={{
                      width: "100%",
                      padding: "0.5rem 0.75rem",
                      border: "1px solid #d1d5db",
                      borderRadius: "0.5rem",
                      fontSize: "0.875rem",
                    }}
                  />
                </div>
              </div>

              {/* Community notice */}
              <div
                style={{
                  background: "#fefce8",
                  border: "1px solid #fcd34d",
                  borderRadius: "0.5rem",
                  padding: "0.5rem 0.75rem",
                  fontSize: "0.72rem",
                  color: "#92400e",
                  marginBottom: "1rem",
                }}
              >
                ⚠ Overrides are recommendations requiring human review — they are not auto-applied.
              </div>

              <button
                type="submit"
                disabled={submitting}
                style={{
                  width: "100%",
                  padding: "0.65rem",
                  background: submitting ? "#9ca3af" : "#4f46e5",
                  color: "#fff",
                  border: "none",
                  borderRadius: "0.5rem",
                  fontWeight: 700,
                  fontSize: "0.875rem",
                  cursor: submitting ? "not-allowed" : "pointer",
                  marginBottom: "0.5rem",
                }}
              >
                {submitting ? "Submitting…" : "Submit Community Override"}
              </button>

              {/* CSV download */}
              <a
                href={api.manifestUrl(thresholds)}
                download
                style={{
                  display: "block",
                  width: "100%",
                  padding: "0.55rem",
                  background: "#f0fdf4",
                  color: "#059669",
                  border: "1px solid #6ee7b7",
                  borderRadius: "0.5rem",
                  fontWeight: 600,
                  fontSize: "0.82rem",
                  cursor: "pointer",
                  textAlign: "center",
                  textDecoration: "none",
                }}
              >
                📥 Download Field Manifest (CSV)
              </a>
            </form>
          )}
        </div>
      </div>
    </>
  );
}
