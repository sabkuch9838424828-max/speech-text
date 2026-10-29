import React, { useState, useRef, useEffect } from "react";
import { api } from "../../api/client";
import type { Prompt, User } from "../../types";

const SUPPORTED_LANGUAGES = [
  { name: "Hindi", dialects: ["Standard", "Bhojpuri-influenced", "Awadhi-influenced"] },
  { name: "Marathi", dialects: ["Standard", "Deshi / Western", "Vidarbha"] },
  { name: "Bhojpuri", dialects: ["Standard", "Western", "Eastern"] },
  { name: "Chhattisgarhi", dialects: ["Standard", "Central"] },
  { name: "Maithili", dialects: ["Standard", "Central"] },
];

interface AiSubmissionPageProps {
  user: User;
  onNavigate: (route: string) => void;
  onSubmissionComplete?: () => void;
}

export function AiSubmissionPage({ onNavigate, onSubmissionComplete }: AiSubmissionPageProps) {
  const [mode, setMode] = useState<"guided" | "natural">("guided");

  // Selection states
  const [selectedLanguage, setSelectedLanguage] = useState("Hindi");
  const [selectedDialect, setSelectedDialect] = useState("Standard");
  const [district, setDistrict] = useState("");
  const [gender, setGender] = useState("");
  const [ageGroup, setAgeGroup] = useState("");
  const [speechContext, setSpeechContext] = useState("");

  // Informed consent
  const [consentGiven, setConsentGiven] = useState(true);
  const [ageVerified, setAgeVerified] = useState(true);

  // Mode A Prompts
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [selectedPrompt, setSelectedPrompt] = useState<Prompt | null>(null);
  const [loadingPrompts, setLoadingPrompts] = useState(false);

  // Audio recording
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [micSupported, setMicSupported] = useState(true);
  const [micError, setMicError] = useState<string | null>(null);

  // Submission workflow
  const [submitting, setSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [successInfo, setSuccessInfo] = useState<{
    submissionId: string;
    deletionToken: string;
    hypothesis: string;
    reference?: string;
    wer?: number | null;
    status: string;
    duplicateDetected?: boolean;
  } | null>(null);

  // Right to erasure / withdrawal
  const [withdrawing, setWithdrawing] = useState(false);
  const [withdrawMessage, setWithdrawMessage] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setMicSupported(false);
    }
  }, []);

  useEffect(() => {
    if (mode === "guided") {
      setLoadingPrompts(true);
      api.prompts({ language: selectedLanguage })
        .then((res) => {
          setPrompts(res.prompts);
          if (res.prompts.length > 0) {
            setSelectedPrompt(res.prompts[0]);
          } else {
            setSelectedPrompt(null);
          }
        })
        .catch(() => setPrompts([]))
        .finally(() => setLoadingPrompts(false));
    }
  }, [mode, selectedLanguage]);

  useEffect(() => {
    return () => {
      if (audioUrl) URL.revokeObjectURL(audioUrl);
      if (timerRef.current) window.clearInterval(timerRef.current);
    };
  }, [audioUrl]);

  const startRecording = async () => {
    setMicError(null);
    setErrorMessage(null);
    setAudioBlob(null);
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioUrl(null);
    audioChunksRef.current = [];

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : "audio/webm";

      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        const blob = new Blob(audioChunksRef.current, { type: mimeType });
        setAudioBlob(blob);
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);
      };

      mediaRecorder.start(200);
      setIsRecording(true);
      setRecordingSeconds(0);

      timerRef.current = window.setInterval(() => {
        setRecordingSeconds((prev) => {
          if (prev >= 60) {
            stopRecording();
            return 60;
          }
          return prev + 1;
        });
      }, 1000);
    } catch (err: unknown) {
      setMicError(err instanceof Error ? err.message : "Microphone permission denied.");
      setIsRecording(false);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) {
        window.clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  };

  const retakeRecording = () => {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioBlob(null);
    setAudioUrl(null);
    setRecordingSeconds(0);
    setErrorMessage(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 15 * 1024 * 1024) {
      setErrorMessage("File exceeds the 15MB limit.");
      return;
    }

    setAudioBlob(file);
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioUrl(URL.createObjectURL(file));
    setErrorMessage(null);
  };

  const playPromptSpeech = () => {
    if (!selectedPrompt || typeof window === "undefined" || !("speechSynthesis" in window)) return;
    const utterance = new SpeechSynthesisUtterance(selectedPrompt.text);
    if (selectedPrompt.language === "Hindi") utterance.lang = "hi-IN";
    else if (selectedPrompt.language === "Marathi") utterance.lang = "mr-IN";
    else utterance.lang = "hi-IN";
    window.speechSynthesis.speak(utterance);
  };

  const blobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  };

  const executeSubmission = async () => {
    setShowPreviewModal(false);
    if (!audioBlob) {
      setErrorMessage("Please record or select an audio sample before submitting.");
      return;
    }
    if (!consentGiven || !ageVerified) {
      setErrorMessage("Explicit informed consent and age verification are required.");
      return;
    }

    setSubmitting(true);
    setUploadProgress("Validating audio format and computing SHA-256 integrity hash...");
    setErrorMessage(null);

    try {
      const base64Data = await blobToBase64(audioBlob);
      setUploadProgress("Transcribing via regional ASR engine and evaluating WER alignment...");

      const payload = {
        contribution_mode: mode,
        language: selectedLanguage,
        dialect: selectedDialect || undefined,
        speech_context: mode === "natural" ? speechContext.trim() || undefined : undefined,
        prompt_id: mode === "guided" ? selectedPrompt?.id : undefined,
        reference_text: mode === "guided" ? selectedPrompt?.text : undefined,
        district: district.trim() || undefined,
        gender: gender || undefined,
        age_group: ageGroup || undefined,
        consent_given: consentGiven,
        age_verified: ageVerified,
        audio_base64: base64Data,
        audio_filename: `voice_${Date.now()}.${audioBlob.type.includes("wav") ? "wav" : "webm"}`,
        content_type: audioBlob.type || "audio/webm",
      };

      const res = await api.submitVoice(payload);
      setSuccessInfo({
        submissionId: res.submission_id,
        deletionToken: res.deletion_token,
        hypothesis: res.hypothesis_text,
        reference: res.reference_text,
        wer: res.wer_pct,
        status: res.status,
        duplicateDetected: res.duplicate_detected,
      });

      retakeRecording();
      if (onSubmissionComplete) onSubmissionComplete();
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : "Submission failed.");
    } finally {
      setSubmitting(false);
      setUploadProgress(null);
    }
  };

  const handleWithdraw = async () => {
    if (!successInfo) return;
    if (!confirm("Are you sure you want to withdraw this recording? It will permanently purge your audio from disk.")) {
      return;
    }

    setWithdrawing(true);
    setWithdrawMessage(null);
    try {
      const res = await api.withdrawSubmission(
        successInfo.submissionId,
        successInfo.deletionToken,
        "Contributor exercised right to erasure"
      );
      setWithdrawMessage(res.message);
      setSuccessInfo((prev) => (prev ? { ...prev, status: "WITHDRAWN" } : null));
    } catch (err: unknown) {
      setWithdrawMessage(err instanceof Error ? err.message : "Withdrawal failed.");
    } finally {
      setWithdrawing(false);
    }
  };

  const dialectsForLang = SUPPORTED_LANGUAGES.find((l) => l.name === selectedLanguage)?.dialects ?? ["Standard"];

  return (
    <div style={{ maxWidth: "860px", margin: "0 auto" }}>
      {/* Back button & Page title */}
      <div style={{ marginBottom: "1.25rem", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
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

        <span style={{ fontSize: "0.78rem", color: "#64748B", fontWeight: 500 }}>
          Protected by Policy v2.0 · Private Storage
        </span>
      </div>

      {/* Main card */}
      <div className="bl-card" style={{ padding: "2rem" }}>
        <div style={{ marginBottom: "1.5rem" }}>
          <h1 style={{ fontSize: "1.35rem", fontWeight: 800, color: "#1F2937", margin: "0 0 0.35rem" }}>
            Dedicated AI Input Submission
          </h1>
          <p style={{ fontSize: "0.88rem", color: "#64748B", margin: 0 }}>
            Submit voice data for AI transcription. Choose between verified sentence reading or authentic conversational speech.
          </p>
        </div>

        {/* Contribution Mode Selection */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1.5rem" }}>
          <button
            type="button"
            onClick={() => { setMode("guided"); retakeRecording(); }}
            style={{
              padding: "1rem",
              borderRadius: "10px",
              border: mode === "guided" ? "2px solid #2563EB" : "1px solid #E2E8F0",
              background: mode === "guided" ? "#EFF6FF" : "#FFFFFF",
              color: mode === "guided" ? "#1E40AF" : "#334155",
              textAlign: "left",
              cursor: "pointer",
            }}
          >
            <div style={{ fontSize: "0.95rem", fontWeight: 700 }}>📖 Mode A: Guided Sentence Reading</div>
            <div style={{ fontSize: "0.78rem", color: mode === "guided" ? "#2563EB" : "#64748B", marginTop: "0.25rem" }}>
              Read a verified reference prompt in your chosen regional language.
            </div>
          </button>

          <button
            type="button"
            onClick={() => { setMode("natural"); retakeRecording(); }}
            style={{
              padding: "1rem",
              borderRadius: "10px",
              border: mode === "natural" ? "2px solid #0D9488" : "1px solid #E2E8F0",
              background: mode === "natural" ? "#F0FDFA" : "#FFFFFF",
              color: mode === "natural" ? "#0F766E" : "#334155",
              textAlign: "left",
              cursor: "pointer",
            }}
          >
            <div style={{ fontSize: "0.95rem", fontWeight: 700 }}>💬 Mode B: Natural Speech</div>
            <div style={{ fontSize: "0.78rem", color: mode === "natural" ? "#0D9488" : "#64748B", marginTop: "0.25rem" }}>
              Contribute conversational voice recordings from everyday contexts.
            </div>
          </button>
        </div>

        {/* Language & Dialect Selectors */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1.25rem" }}>
          <div>
            <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 600, color: "#374151", marginBottom: "0.35rem" }}>
              Target Language *
            </label>
            <select
              value={selectedLanguage}
              onChange={(e) => {
                setSelectedLanguage(e.target.value);
                const firstDialect = SUPPORTED_LANGUAGES.find((l) => l.name === e.target.value)?.dialects[0] ?? "Standard";
                setSelectedDialect(firstDialect);
              }}
              style={{ width: "100%" }}
            >
              {SUPPORTED_LANGUAGES.map((l) => (
                <option key={l.name} value={l.name}>{l.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 600, color: "#374151", marginBottom: "0.35rem" }}>
              Dialect / Regional Variety
            </label>
            <select
              value={selectedDialect}
              onChange={(e) => setSelectedDialect(e.target.value)}
              style={{ width: "100%" }}
            >
              {dialectsForLang.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Mode A: Target Prompt Display */}
        {mode === "guided" && (
          <div
            style={{
              background: "#F8FAFC",
              border: "1px solid #E2E8F0",
              borderRadius: "10px",
              padding: "1.25rem",
              marginBottom: "1.5rem",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
              <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "#64748B", textTransform: "uppercase" }}>
                Reference Sentence to Read Aloud:
              </span>
              <button
                type="button"
                onClick={playPromptSpeech}
                style={{
                  background: "#EFF6FF",
                  border: "1px solid #BFDBFE",
                  color: "#2563EB",
                  padding: "0.25rem 0.6rem",
                  borderRadius: "6px",
                  fontSize: "0.75rem",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                🔊 Listen Preview
              </button>
            </div>

            {loadingPrompts ? (
              <div style={{ color: "#94A3B8", fontSize: "0.85rem" }}>Loading sentences…</div>
            ) : selectedPrompt ? (
              <div>
                <p style={{ fontSize: "1.2rem", fontWeight: 700, color: "#1F2937", lineHeight: 1.6, margin: "0.25rem 0 0.5rem" }}>
                  {selectedPrompt.text}
                </p>
                <div style={{ fontSize: "0.75rem", color: "#64748B", display: "flex", gap: "0.75rem" }}>
                  <span>Domain: <strong>{selectedPrompt.domain}</strong></span>
                  <span>Difficulty: <strong>{selectedPrompt.difficulty}</strong></span>
                </div>
              </div>
            ) : (
              <p style={{ color: "#94A3B8", fontSize: "0.85rem", margin: 0 }}>
                No pre-configured prompt found for this language. You may contribute in Natural mode.
              </p>
            )}

            {prompts.length > 1 && (
              <div style={{ marginTop: "0.75rem" }}>
                <select
                  value={selectedPrompt?.id ?? ""}
                  onChange={(e) => {
                    const p = prompts.find((item) => item.id === e.target.value);
                    if (p) setSelectedPrompt(p);
                  }}
                  style={{ width: "100%", fontSize: "0.8rem", padding: "0.35rem 0.5rem" }}
                >
                  {prompts.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.text}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        )}

        {/* Mode B: Speech Context Input */}
        {mode === "natural" && (
          <div style={{ marginBottom: "1.25rem" }}>
            <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 600, color: "#374151", marginBottom: "0.35rem" }}>
              Optional Context / Topic Description
            </label>
            <input
              type="text"
              value={speechContext}
              onChange={(e) => setSpeechContext(e.target.value)}
              placeholder="e.g. Village market discussion, farming forecast, folk tale"
              style={{ width: "100%", boxSizing: "border-box" }}
            />
          </div>
        )}

        {/* Audio Recording / Upload Section */}
        <div
          style={{
            border: isRecording ? "2px solid #EF4444" : "2px dashed #CBD5E1",
            borderRadius: "12px",
            padding: "1.75rem",
            textAlign: "center",
            background: isRecording ? "#FEF2F2" : "#F8FAFC",
            marginBottom: "1.5rem",
            transition: "all 0.15s ease",
          }}
        >
          {isRecording ? (
            <div>
              <div style={{ fontSize: "1.5rem", fontWeight: 800, color: "#DC2626", marginBottom: "0.5rem" }}>
                🔴 Recording: {recordingSeconds}s / 60s
              </div>
              <p style={{ fontSize: "0.82rem", color: "#991B1B", margin: "0 0 1rem" }}>
                Speak clearly into your microphone.
              </p>
              <button
                type="button"
                onClick={stopRecording}
                style={{
                  background: "#DC2626",
                  color: "#FFFFFF",
                  border: "none",
                  padding: "0.6rem 1.5rem",
                  borderRadius: "8px",
                  fontWeight: 700,
                  fontSize: "0.95rem",
                  cursor: "pointer",
                }}
              >
                ⏹️ Complete Recording
              </button>
            </div>
          ) : audioUrl ? (
            <div>
              <div style={{ fontSize: "0.95rem", fontWeight: 700, color: "#059669", marginBottom: "0.5rem" }}>
                ✅ Audio Captured ({recordingSeconds > 0 ? `${recordingSeconds}s` : "File Selected"})
              </div>
              <div style={{ maxWidth: "380px", margin: "0 auto 1rem" }}>
                <audio controls src={audioUrl} style={{ width: "100%" }} />
              </div>
              <div style={{ display: "flex", justifyContent: "center", gap: "0.75rem" }}>
                <button
                  type="button"
                  onClick={retakeRecording}
                  style={{
                    background: "#FFFFFF",
                    border: "1px solid #CBD5E1",
                    color: "#475569",
                    padding: "0.45rem 0.9rem",
                    borderRadius: "6px",
                    fontSize: "0.82rem",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  🔄 Retake or Choose Another File
                </button>
              </div>
            </div>
          ) : (
            <div>
              <div style={{ fontSize: "2rem", marginBottom: "0.35rem" }}>🎙️</div>
              <p style={{ fontSize: "0.85rem", color: "#475569", margin: "0 0 1rem" }}>
                Record directly in browser or upload an audio recording file.
              </p>

              <div style={{ display: "flex", justifyContent: "center", gap: "1rem", flexWrap: "wrap" }}>
                {micSupported ? (
                  <button
                    type="button"
                    onClick={startRecording}
                    style={{
                      background: "#2563EB",
                      color: "#FFFFFF",
                      border: "none",
                      padding: "0.65rem 1.4rem",
                      borderRadius: "8px",
                      fontWeight: 700,
                      fontSize: "0.9rem",
                      cursor: "pointer",
                    }}
                  >
                    🔴 Start Recording
                  </button>
                ) : (
                  <div style={{ color: "#D97706", fontSize: "0.82rem" }}>
                    ⚠️ Microphone not available. Please use audio file upload below.
                  </div>
                )}

                <label
                  style={{
                    background: "#FFFFFF",
                    border: "1px solid #CBD5E1",
                    color: "#334155",
                    padding: "0.65rem 1.25rem",
                    borderRadius: "8px",
                    fontWeight: 600,
                    fontSize: "0.9rem",
                    cursor: "pointer",
                    boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
                  }}
                >
                  📁 Upload Audio File
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="audio/*,.wav,.mp3,.ogg,.webm,.m4a"
                    onChange={handleFileUpload}
                    style={{ display: "none" }}
                  />
                </label>
              </div>

              {micError && (
                <div style={{ marginTop: "0.75rem", color: "#DC2626", fontSize: "0.8rem" }}>
                  ⚠️ {micError}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Demographic Metadata Slice */}
        <div
          style={{
            background: "#F8FAFC",
            border: "1px solid #E2E8F0",
            borderRadius: "10px",
            padding: "1.25rem",
            marginBottom: "1.5rem",
          }}
        >
          <div style={{ fontSize: "0.85rem", fontWeight: 700, color: "#1F2937", marginBottom: "0.25rem" }}>
            Demographic Slice (Strictly Optional)
          </div>
          <p style={{ fontSize: "0.75rem", color: "#64748B", margin: "0 0 0.75rem" }}>
            Used solely to measure regional accent coverage and address representation gaps. Never linked to private identity.
          </p>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.75rem" }}>
            <div>
              <label style={{ fontSize: "0.75rem", color: "#475569", display: "block", marginBottom: "0.25rem" }}>District</label>
              <input
                type="text"
                value={district}
                onChange={(e) => setDistrict(e.target.value)}
                placeholder="e.g. Pune, Bhojpur"
                style={{ width: "100%", fontSize: "0.82rem", boxSizing: "border-box" }}
              />
            </div>

            <div>
              <label style={{ fontSize: "0.75rem", color: "#475569", display: "block", marginBottom: "0.25rem" }}>Gender</label>
              <select
                value={gender}
                onChange={(e) => setGender(e.target.value)}
                style={{ width: "100%", fontSize: "0.82rem" }}
              >
                <option value="">Prefer not to say</option>
                <option value="female">Female</option>
                <option value="male">Male</option>
                <option value="other">Other</option>
              </select>
            </div>

            <div>
              <label style={{ fontSize: "0.75rem", color: "#475569", display: "block", marginBottom: "0.25rem" }}>Age Group</label>
              <select
                value={ageGroup}
                onChange={(e) => setAgeGroup(e.target.value)}
                style={{ width: "100%", fontSize: "0.82rem" }}
              >
                <option value="">Prefer not to say</option>
                <option value="18-30">18–30</option>
                <option value="31-50">31–50</option>
                <option value="51+">51+</option>
                <option value="under-18">Under 18 (guardian consent)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Informed Consent Notice */}
        <div
          style={{
            background: "#FFFBEB",
            border: "1px solid #FDE68A",
            borderRadius: "10px",
            padding: "1.25rem",
            marginBottom: "1.5rem",
          }}
        >
          <div style={{ fontSize: "0.85rem", fontWeight: 700, color: "#92400e", marginBottom: "0.35rem" }}>
            🛡️ Informed Consent &amp; Privacy Notice
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            <label style={{ display: "flex", alignItems: "flex-start", gap: "0.5rem", fontSize: "0.82rem", color: "#78350F", cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={consentGiven}
                onChange={(e) => setConsentGiven(e.target.checked)}
                style={{ marginTop: "0.2rem" }}
              />
              <span>I give explicit informed consent for my voice sample to be analyzed and included in human-verified speech evaluation benchmarks under Policy v2.0.</span>
            </label>

            <label style={{ display: "flex", alignItems: "flex-start", gap: "0.5rem", fontSize: "0.82rem", color: "#78350F", cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={ageVerified}
                onChange={(e) => setAgeVerified(e.target.checked)}
                style={{ marginTop: "0.2rem" }}
              />
              <span>I confirm I am 18 years or older, or have appropriate guardian consent to contribute.</span>
            </label>
          </div>
        </div>

        {/* Error message */}
        {errorMessage && (
          <div
            role="alert"
            style={{
              background: "#FEF2F2",
              border: "1px solid #FECACA",
              color: "#DC2626",
              padding: "0.75rem 1rem",
              borderRadius: "8px",
              fontSize: "0.85rem",
              marginBottom: "1rem",
            }}
          >
            ⚠️ {errorMessage}
          </div>
        )}

        {/* Progress indicator */}
        {uploadProgress && (
          <div style={{ color: "#2563EB", fontSize: "0.85rem", fontWeight: 600, marginBottom: "1rem" }}>
            ⏳ {uploadProgress}
          </div>
        )}

        {/* Action buttons */}
        <div style={{ display: "flex", gap: "1rem" }}>
          <button
            type="button"
            onClick={() => onNavigate("/app")}
            style={{
              flex: 1,
              padding: "0.75rem",
              background: "#F1F5F9",
              border: "1px solid #CBD5E1",
              borderRadius: "8px",
              color: "#475569",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={() => setShowPreviewModal(true)}
            disabled={submitting || !audioBlob || !consentGiven || !ageVerified}
            style={{
              flex: 2,
              padding: "0.75rem",
              background: !audioBlob || !consentGiven || !ageVerified ? "#94A3B8" : "#2563EB",
              color: "#FFFFFF",
              border: "none",
              borderRadius: "8px",
              fontWeight: 700,
              fontSize: "0.95rem",
              cursor: !audioBlob || !consentGiven || !ageVerified ? "not-allowed" : "pointer",
              boxShadow: "0 2px 4px rgba(37, 99, 235, 0.2)",
            }}
          >
            {submitting ? "Analyzing Contribution…" : "Preview & Submit Voice →"}
          </button>
        </div>
      </div>

      {/* Confirmation & Submission Preview Modal */}
      {showPreviewModal && (
        <div className="bl-modal-backdrop">
          <div className="bl-modal-content" style={{ padding: "1.75rem", maxWidth: "520px" }}>
            <h3 style={{ fontSize: "1.2rem", fontWeight: 700, color: "#1F2937", margin: "0 0 0.5rem" }}>
              Confirm AI Voice Submission
            </h3>
            <p style={{ fontSize: "0.82rem", color: "#64748B", margin: "0 0 1.25rem" }}>
              Please review what will be ingested into the speech benchmark pipeline:
            </p>

            <div style={{ background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: "8px", padding: "1rem", fontSize: "0.85rem", marginBottom: "1.25rem" }}>
              <div style={{ marginBottom: "0.4rem" }}><strong>Mode:</strong> {mode === "guided" ? "Mode A: Guided Reading" : "Mode B: Natural Speech"}</div>
              <div style={{ marginBottom: "0.4rem" }}><strong>Language:</strong> {selectedLanguage} ({selectedDialect})</div>
              {district && <div style={{ marginBottom: "0.4rem" }}><strong>District:</strong> {district}</div>}
              {mode === "guided" && selectedPrompt && (
                <div style={{ marginTop: "0.5rem", paddingTop: "0.5rem", borderTop: "1px dashed #CBD5E1" }}>
                  <strong>Reference Sentence:</strong>
                  <div style={{ color: "#1F2937", marginTop: "0.25rem", fontStyle: "italic" }}>"{selectedPrompt.text}"</div>
                </div>
              )}
            </div>

            <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end" }}>
              <button
                type="button"
                onClick={() => setShowPreviewModal(false)}
                style={{
                  padding: "0.5rem 1rem",
                  background: "#F1F5F9",
                  border: "1px solid #CBD5E1",
                  borderRadius: "6px",
                  fontWeight: 600,
                  fontSize: "0.82rem",
                  cursor: "pointer",
                }}
              >
                Back to Edit
              </button>
              <button
                type="button"
                onClick={executeSubmission}
                style={{
                  padding: "0.5rem 1.25rem",
                  background: "#2563EB",
                  color: "#FFFFFF",
                  border: "none",
                  borderRadius: "6px",
                  fontWeight: 700,
                  fontSize: "0.82rem",
                  cursor: "pointer",
                }}
              >
                Confirm &amp; Run ASR Analysis
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Real Backend Response Card */}
      {successInfo && (
        <div
          style={{
            marginTop: "1.5rem",
            background: "#ECFDF5",
            border: "1px solid #A7F3D0",
            borderRadius: "14px",
            padding: "1.5rem",
            boxShadow: "0 1px 3px rgba(15, 23, 42, 0.05)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
            <h3 style={{ fontSize: "1.15rem", fontWeight: 700, color: "#065F46", margin: 0 }}>
              🎉 Submission Processed Successfully
            </h3>
            <span
              className="bl-badge bl-badge-success"
              style={{ fontSize: "0.78rem" }}
            >
              Status: {successInfo.status}
            </span>
          </div>

          <p style={{ fontSize: "0.85rem", color: "#047857", margin: "0 0 1rem" }}>
            Your audio was safely ingested into private storage. The Regional ASR Model evaluated your speech:
          </p>

          <div style={{ background: "#FFFFFF", border: "1px solid #A7F3D0", borderRadius: "8px", padding: "1rem", marginBottom: "1rem" }}>
            {successInfo.reference && (
              <div style={{ marginBottom: "0.5rem", fontSize: "0.85rem" }}>
                <span style={{ fontWeight: 600, color: "#64748B" }}>Reference: </span>
                <span style={{ color: "#1F2937" }}>{successInfo.reference}</span>
              </div>
            )}
            <div style={{ fontSize: "0.88rem" }}>
              <span style={{ fontWeight: 600, color: "#64748B" }}>ASR Hypothesis: </span>
              <span style={{ fontWeight: 700, color: "#2563EB" }}>{successInfo.hypothesis}</span>
            </div>
            {successInfo.wer !== null && successInfo.wer !== undefined && (
              <div style={{ marginTop: "0.5rem", fontSize: "0.8rem", color: "#475569" }}>
                Unverified ASR WER: <strong>{successInfo.wer.toFixed(1)}%</strong> (pending linguist review)
              </div>
            )}
          </div>

          {/* Submission Credentials */}
          <div style={{ background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: "8px", padding: "0.85rem", fontSize: "0.8rem", marginBottom: "1rem" }}>
            <div><strong>Submission ID:</strong> <code>{successInfo.submissionId}</code></div>
            <div style={{ marginTop: "0.25rem" }}><strong>Deletion Secret Token:</strong> <code>{successInfo.deletionToken}</code></div>
          </div>

          {/* Erasure Action */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.75rem" }}>
            <button
              type="button"
              onClick={handleWithdraw}
              disabled={withdrawing || successInfo.status === "WITHDRAWN"}
              style={{
                background: successInfo.status === "WITHDRAWN" ? "#E2E8F0" : "#FEE2E2",
                color: successInfo.status === "WITHDRAWN" ? "#94A3B8" : "#991B1B",
                border: "1px solid #FECACA",
                padding: "0.45rem 0.9rem",
                borderRadius: "6px",
                fontSize: "0.78rem",
                fontWeight: 600,
                cursor: successInfo.status === "WITHDRAWN" ? "not-allowed" : "pointer",
              }}
            >
              {withdrawing ? "Purging Audio…" : successInfo.status === "WITHDRAWN" ? "Record Withdrawn & Audio Purged" : "🗑️ Withdraw Recording Now"}
            </button>

            <button
              type="button"
              onClick={() => onNavigate("/app/submissions")}
              style={{
                background: "#059669",
                color: "#FFFFFF",
                border: "none",
                padding: "0.45rem 1rem",
                borderRadius: "6px",
                fontSize: "0.82rem",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              View in My Submissions →
            </button>
          </div>

          {withdrawMessage && (
            <div style={{ marginTop: "0.75rem", fontSize: "0.8rem", color: "#047857", fontWeight: 600 }}>
              ✓ {withdrawMessage}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
