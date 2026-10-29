import { useState } from "react";
import type { CollectionPriority, FeedbackPayload } from "../types";
import { api } from "../api/client";

interface FeedbackModalProps {
  priority: CollectionPriority | null;
  onClose: () => void;
}

export function FeedbackModal({ priority, onClose }: FeedbackModalProps) {
  const [reviewer, setReviewer] = useState("");
  const [comment, setComment] = useState("");
  const [agreed, setAgreed] = useState<boolean | undefined>(undefined);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!priority) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reviewer.trim()) { setError("Please enter your name."); return; }
    if (!comment.trim()) { setError("Please enter a comment."); return; }
    setError(null);
    setSubmitting(true);

    const payload: FeedbackPayload = {
      cell_id: `${priority.district}|${priority.gender}|${priority.age_group}`,
      comment: comment.trim(),
      reviewer: reviewer.trim(),
      agreed_with_priority: agreed,
    };

    try {
      const res = await api.submitFeedback(payload);
      setResult({ success: res.accepted, message: res.message });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Submission failed.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    setReviewer("");
    setComment("");
    setAgreed(undefined);
    setResult(null);
    setError(null);
    onClose();
  };

  return (
    /* Backdrop */
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="feedback-title"
      onClick={(e) => e.target === e.currentTarget && handleClose()}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.4)",
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
          padding: "1.5rem",
          maxWidth: "480px",
          width: "100%",
          boxShadow: "0 20px 60px rgba(0,0,0,0.2)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1rem" }}>
          <h2 id="feedback-title" style={{ margin: 0, fontSize: "1.1rem", fontWeight: 700, color: "#1f2937" }}>
            Community Review
          </h2>
          <button
            onClick={handleClose}
            aria-label="Close feedback modal"
            style={{ background: "none", border: "none", fontSize: "1.25rem", cursor: "pointer", color: "#9ca3af" }}
          >
            ×
          </button>
        </div>

        {/* Priority summary */}
        <div style={{ background: "#f9fafb", borderRadius: "0.5rem", padding: "0.75rem", marginBottom: "1.25rem", fontSize: "0.82rem" }}>
          <p style={{ margin: "0 0 0.25rem", fontWeight: 600, color: "#374151" }}>
            {priority.district} · {priority.gender} · {priority.age_group}
          </p>
          <p style={{ margin: 0, color: "#6b7280", lineHeight: 1.5 }}>{priority.reason}</p>
          <p style={{ margin: "0.5rem 0 0", fontSize: "0.72rem", color: "#9ca3af" }}>
            ⚠ This is a recommendation, not an automatic decision. Your review will inform human follow-up.
          </p>
        </div>

        {result ? (
          <div style={{ textAlign: "center", padding: "1rem" }}>
            <p style={{ fontSize: "1.5rem", margin: "0 0 0.5rem" }}>{result.success ? "✅" : "❌"}</p>
            <p style={{ color: "#374151", margin: 0 }}>{result.message}</p>
            <button
              onClick={handleClose}
              style={{
                marginTop: "1rem",
                padding: "0.5rem 1.5rem",
                background: "#6366f1",
                color: "#fff",
                border: "none",
                borderRadius: "0.5rem",
                cursor: "pointer",
                fontWeight: 600,
              }}
            >
              Close
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} noValidate>
            {error && (
              <div role="alert" style={{ color: "#dc2626", background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: "0.5rem", padding: "0.5rem 0.75rem", marginBottom: "0.75rem", fontSize: "0.82rem" }}>
                {error}
              </div>
            )}

            <label style={{ display: "flex", flexDirection: "column", gap: "0.3rem", marginBottom: "0.75rem" }}>
              <span style={{ fontSize: "0.82rem", fontWeight: 600, color: "#374151" }}>Your name *</span>
              <input
                type="text"
                value={reviewer}
                onChange={(e) => setReviewer(e.target.value)}
                placeholder="e.g. Priya Patil"
                required
                aria-required="true"
                style={{ padding: "0.45rem 0.75rem", border: "1px solid #d1d5db", borderRadius: "0.5rem", fontSize: "0.875rem" }}
              />
            </label>

            <label style={{ display: "flex", flexDirection: "column", gap: "0.3rem", marginBottom: "0.75rem" }}>
              <span style={{ fontSize: "0.82rem", fontWeight: 600, color: "#374151" }}>Comment *</span>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Share your perspective on this collection priority..."
                required
                aria-required="true"
                rows={3}
                style={{ padding: "0.45rem 0.75rem", border: "1px solid #d1d5db", borderRadius: "0.5rem", fontSize: "0.875rem", resize: "vertical" }}
              />
            </label>

            <div style={{ marginBottom: "1rem" }}>
              <span style={{ fontSize: "0.82rem", fontWeight: 600, color: "#374151", display: "block", marginBottom: "0.35rem" }}>
                Do you agree with this priority? (optional)
              </span>
              <div style={{ display: "flex", gap: "0.75rem" }}>
                {[
                  { value: true, label: "Yes" },
                  { value: false, label: "No" },
                ].map((opt) => (
                  <label key={String(opt.value)} style={{ display: "flex", alignItems: "center", gap: "0.35rem", cursor: "pointer", fontSize: "0.875rem" }}>
                    <input
                      type="radio"
                      name="agreed"
                      checked={agreed === opt.value}
                      onChange={() => setAgreed(opt.value)}
                    />
                    {opt.label}
                  </label>
                ))}
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              style={{
                width: "100%",
                padding: "0.6rem",
                background: submitting ? "#a5b4fc" : "#6366f1",
                color: "#fff",
                border: "none",
                borderRadius: "0.5rem",
                fontWeight: 700,
                fontSize: "0.9rem",
                cursor: submitting ? "not-allowed" : "pointer",
              }}
            >
              {submitting ? "Submitting…" : "Submit Review"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
