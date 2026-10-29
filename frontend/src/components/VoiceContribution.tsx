import { useState, useRef, useEffect } from "react";
import { api } from "../api/client";
import type { Prompt } from "../types";

const SUPPORTED_LANGUAGES = [
  { name: "Hindi", dialects: ["Standard", "Bhojpuri-influenced", "Awadhi-influenced"] },
  { name: "Marathi", dialects: ["Standard", "Deshi / Western", "Vidarbha"] },
  { name: "Bhojpuri", dialects: ["Standard", "Western", "Eastern"] },
  { name: "Chhattisgarhi", dialects: ["Standard", "Central"] },
  { name: "Maithili", dialects: ["Standard", "Central"] },
];

export function VoiceContribution({ onSubmissionSuccess }: { onSubmissionSuccess?: () => void }) {
  const [mode, setMode] = useState<"guided" | "natural">("guided");

  // Common Form States
  const [selectedLanguage, setSelectedLanguage] = useState("Hindi");
  const [selectedDialect, setSelectedDialect] = useState("Standard");
  const [district, setDistrict] = useState("");
  const [gender, setGender] = useState("");
  const [ageGroup, setAgeGroup] = useState("");
  const [speechContext, setSpeechContext] = useState("");

  // Consent
  const [consentGiven, setConsentGiven] = useState(false);
  const [ageVerified, setAgeVerified] = useState(false);

  // Mode A Prompts
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [selectedPrompt, setSelectedPrompt] = useState<Prompt | null>(null);
  const [loadingPrompts, setLoadingPrompts] = useState(false);

  // Audio Recording States
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [micSupported, setMicSupported] = useState(true);
  const [micError, setMicError] = useState<string | null>(null);

  // Submission States
  const [submitting, setSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successInfo, setSuccessInfo] = useState<{
    submissionId: string;
    deletionToken: string;
    hypothesis: string;
    reference?: string;
    wer?: number | null;
    status: string;
  } | null>(null);

  // Withdrawal States
  const [withdrawing, setWithdrawing] = useState(false);
  const [withdrawMessage, setWithdrawMessage] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Check microphone availability on mount
  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setMicSupported(false);
    }
  }, []);

  // Fetch prompts when language or dialect changes in Mode A
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

  // Clean up audio blob URL on unmount
  useEffect(() => {
    return () => {
      if (audioUrl) URL.revokeObjectURL(audioUrl);
      if (timerRef.current) window.clearInterval(timerRef.current);
    };
  }, [audioUrl]);

  // Start recording
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

      mediaRecorder.start(200); // 200ms timeslices
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
      setMicError(err instanceof Error ? err.message : "Microphone permission denied or unavailable.");
      setIsRecording(false);
    }
  };

  // Stop recording
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

  // Retake recording
  const retakeRecording = () => {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioBlob(null);
    setAudioUrl(null);
    setRecordingSeconds(0);
    setErrorMessage(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // Handle local file upload fallback
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 15 * 1024 * 1024) {
      setErrorMessage("File exceeds 15MB limit.");
      return;
    }

    setAudioBlob(file);
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioUrl(URL.createObjectURL(file));
    setErrorMessage(null);
  };

  // Listen to reference prompt using TTS if available
  const playPromptSpeech = () => {
    if (!selectedPrompt || typeof window === "undefined" || !("speechSynthesis" in window)) return;
    const utterance = new SpeechSynthesisUtterance(selectedPrompt.text);
    if (selectedPrompt.language === "Hindi") utterance.lang = "hi-IN";
    else if (selectedPrompt.language === "Marathi") utterance.lang = "mr-IN";
    else utterance.lang = "hi-IN";
    window.speechSynthesis.speak(utterance);
  };

  // Helper to convert Blob to base64
  const blobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const res = reader.result as string;
        resolve(res);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  };

  // Submit Voice Contribution
  const handleSubmit = async () => {
    if (!audioBlob) {
      setErrorMessage("Please record or select an audio sample before submitting.");
      return;
    }
    if (!consentGiven) {
      setErrorMessage("Explicit consent is required to process your submission.");
      return;
    }
    if (!ageVerified) {
      setErrorMessage("Please confirm you are at least 18 years old or have parental consent.");
      return;
    }

    setSubmitting(true);
    setUploadProgress("Encoding audio and validating...");
    setErrorMessage(null);

    try {
      const base64Data = await blobToBase64(audioBlob);
      setUploadProgress("Uploading to secure analysis engine...");

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
        audio_filename: `contribution_${Date.now()}.${audioBlob.type.includes("wav") ? "wav" : "webm"}`,
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
      });

      // Reset form
      retakeRecording();
      if (onSubmissionSuccess) onSubmissionSuccess();
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : "Submission failed. Please check network.");
    } finally {
      setSubmitting(false);
      setUploadProgress(null);
    }
  };

  // Contributor-initiated Withdrawal
  const handleWithdraw = async () => {
    if (!successInfo) return;
    if (!confirm("Are you sure you want to withdraw this recording? It will permanently purge your audio from the server.")) {
      return;
    }

    setWithdrawing(true);
    setWithdrawMessage(null);
    try {
      const res = await api.withdrawSubmission(
        successInfo.submissionId,
        successInfo.deletionToken,
        "Contributor exercised right to erasure immediately after upload"
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
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "1.5rem" }}>
      {/* Header banner */}
      <div
        style={{
          background: "linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)",
          color: "#fff",
          borderRadius: "1rem",
          padding: "1.75rem",
          marginBottom: "1.5rem",
          boxShadow: "0 10px 25px -5px rgba(49, 46, 129, 0.2)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "1rem" }}>
          <div>
            <h2 style={{ margin: "0 0 0.5rem", fontSize: "1.5rem", fontWeight: 700 }}>
              🎙️ Community Voice Contribution
            </h2>
            <p style={{ margin: 0, color: "#c7d2fe", fontSize: "0.9rem", maxWidth: 650 }}>
              Help build an inclusive, representative speech benchmark for Indian languages.
              Your voice contributes to transparent, open-source AI evaluation with strict consent safeguards.
            </p>
          </div>
          <span
            style={{
              background: "#4338ca",
              color: "#e0e7ff",
              padding: "0.35rem 0.75rem",
              borderRadius: "9999px",
              fontSize: "0.75rem",
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            Human-in-the-Loop
          </span>
        </div>
      </div>

      {/* Mode Selector Tabs */}
      <div style={{ display: "flex", gap: "0.75rem", marginBottom: "1.5rem" }}>
        <button
          type="button"
          onClick={() => { setMode("guided"); retakeRecording(); }}
          style={{
            flex: 1,
            padding: "0.85rem 1.25rem",
            borderRadius: "0.75rem",
            border: mode === "guided" ? "2px solid #6366f1" : "1px solid #e2e8f0",
            background: mode === "guided" ? "#eef2ff" : "#fff",
            color: mode === "guided" ? "#4338ca" : "#475569",
            fontWeight: 700,
            cursor: "pointer",
            textAlign: "left",
            transition: "all 0.15s ease",
          }}
        >
          <div style={{ fontSize: "1rem" }}>📖 Mode A: Guided Sentence Reading</div>
          <div style={{ fontSize: "0.78rem", fontWeight: 400, color: mode === "guided" ? "#6366f1" : "#64748b", marginTop: "0.2rem" }}>
            Read a verified reference sentence in your regional language or dialect.
          </div>
        </button>

        <button
          type="button"
          onClick={() => { setMode("natural"); retakeRecording(); }}
          style={{
            flex: 1,
            padding: "0.85rem 1.25rem",
            borderRadius: "0.75rem",
            border: mode === "natural" ? "2px solid #6366f1" : "1px solid #e2e8f0",
            background: mode === "natural" ? "#eef2ff" : "#fff",
            color: mode === "natural" ? "#4338ca" : "#475569",
            fontWeight: 700,
            cursor: "pointer",
            textAlign: "left",
            transition: "all 0.15s ease",
          }}
        >
          <div style={{ fontSize: "1rem" }}>💬 Mode B: Natural Speech Contribution</div>
          <div style={{ fontSize: "0.78rem", fontWeight: 400, color: mode === "natural" ? "#6366f1" : "#64748b", marginTop: "0.2rem" }}>
            Share authentic conversational speech or voice notes from daily contexts.
          </div>
        </button>
      </div>

      {/* Main Contribution Box */}
      <div
        style={{
          background: "#fff",
          border: "1px solid #e2e8f0",
          borderRadius: "1rem",
          padding: "1.75rem",
          boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
        }}
      >
        {/* Language & Dialect Selection */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1.25rem" }}>
          <div>
            <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, color: "#334155", marginBottom: "0.35rem" }}>
              Language *
            </label>
            <select
              value={selectedLanguage}
              onChange={(e) => {
                setSelectedLanguage(e.target.value);
                const firstDialect = SUPPORTED_LANGUAGES.find((l) => l.name === e.target.value)?.dialects[0] ?? "Standard";
                setSelectedDialect(firstDialect);
              }}
              style={{
                width: "100%",
                padding: "0.6rem 0.75rem",
                borderRadius: "0.5rem",
                border: "1px solid #cbd5e1",
                fontSize: "0.9rem",
              }}
            >
              {SUPPORTED_LANGUAGES.map((l) => (
                <option key={l.name} value={l.name}>{l.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, color: "#334155", marginBottom: "0.35rem" }}>
              Dialect / Regional Variety
            </label>
            <select
              value={selectedDialect}
              onChange={(e) => setSelectedDialect(e.target.value)}
              style={{
                width: "100%",
                padding: "0.6rem 0.75rem",
                borderRadius: "0.5rem",
                border: "1px solid #cbd5e1",
                fontSize: "0.9rem",
              }}
            >
              {dialectsForLang.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Mode A: Prompt Card */}
        {mode === "guided" && (
          <div
            style={{
              background: "#f8fafc",
              border: "1px solid #e2e8f0",
              borderRadius: "0.75rem",
              padding: "1.25rem",
              marginBottom: "1.5rem",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
              <span style={{ fontSize: "0.8rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>
                Target Reference Sentence
              </span>
              <button
                type="button"
                onClick={playPromptSpeech}
                style={{
                  background: "#e0e7ff",
                  border: "none",
                  color: "#4338ca",
                  padding: "0.3rem 0.6rem",
                  borderRadius: "0.4rem",
                  fontSize: "0.78rem",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                🔊 Listen Prompt
              </button>
            </div>

            {loadingPrompts ? (
              <div style={{ color: "#94a3b8", fontSize: "0.85rem" }}>Loading sentences...</div>
            ) : selectedPrompt ? (
              <div>
                <p
                  style={{
                    fontSize: "1.25rem",
                    fontWeight: 600,
                    color: "#0f172a",
                    lineHeight: 1.6,
                    margin: "0 0 0.5rem",
                  }}
                >
                  {selectedPrompt.text}
                </p>
                <div style={{ display: "flex", gap: "0.5rem", fontSize: "0.75rem", color: "#64748b" }}>
                  <span>Domain: <strong>{selectedPrompt.domain}</strong></span>
                  <span>·</span>
                  <span>Difficulty: <strong>{selectedPrompt.difficulty}</strong></span>
                </div>
              </div>
            ) : (
              <p style={{ margin: 0, color: "#94a3b8", fontSize: "0.85rem" }}>
                No pre-configured prompts for this selection. You can enter a custom sentence or select another dialect.
              </p>
            )}

            {/* Select another prompt if multiple */}
            {prompts.length > 1 && (
              <div style={{ marginTop: "1rem" }}>
                <label style={{ fontSize: "0.75rem", color: "#64748b", display: "block", marginBottom: "0.25rem" }}>
                  Or select another sentence ({prompts.length} available):
                </label>
                <select
                  value={selectedPrompt?.id ?? ""}
                  onChange={(e) => {
                    const p = prompts.find((item) => item.id === e.target.value);
                    if (p) setSelectedPrompt(p);
                  }}
                  style={{
                    width: "100%",
                    padding: "0.4rem 0.5rem",
                    borderRadius: "0.4rem",
                    border: "1px solid #cbd5e1",
                    fontSize: "0.82rem",
                  }}
                >
                  {prompts.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.text.length > 60 ? p.text.slice(0, 58) + "..." : p.text}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        )}

        {/* Mode B: Speech Context */}
        {mode === "natural" && (
          <div style={{ marginBottom: "1.5rem" }}>
            <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, color: "#334155", marginBottom: "0.35rem" }}>
              Context / Topic Description (Optional)
            </label>
            <input
              type="text"
              value={speechContext}
              onChange={(e) => setSpeechContext(e.target.value)}
              placeholder="e.g., Daily conversation, farming update, folk story, market bargaining"
              style={{
                width: "100%",
                padding: "0.6rem 0.75rem",
                borderRadius: "0.5rem",
                border: "1px solid #cbd5e1",
                fontSize: "0.9rem",
              }}
            />
          </div>
        )}

        {/* Audio Recording & Playback Section */}
        <div
          style={{
            border: "2px dashed #cbd5e1",
            borderRadius: "0.75rem",
            padding: "1.5rem",
            textAlign: "center",
            background: isRecording ? "#fef2f2" : "#f8fafc",
            marginBottom: "1.5rem",
            transition: "all 0.2s ease",
          }}
        >
          {isRecording ? (
            <div>
              <div
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: "50%",
                  background: "#ef4444",
                  margin: "0 auto 0.75rem",
                  animation: "pulse 1.5s infinite",
                }}
              />
              <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "#b91c1c", marginBottom: "0.5rem" }}>
                Recording... {recordingSeconds}s / 60s
              </div>
              <p style={{ margin: "0 0 1rem", fontSize: "0.85rem", color: "#7f1d1d" }}>
                Speak clearly at your normal speaking rate.
              </p>
              <button
                type="button"
                onClick={stopRecording}
                style={{
                  background: "#dc2626",
                  color: "#fff",
                  border: "none",
                  padding: "0.6rem 1.5rem",
                  borderRadius: "0.5rem",
                  fontSize: "0.95rem",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                ⏹️ Stop Recording
              </button>
            </div>
          ) : audioUrl ? (
            <div>
              <div style={{ fontSize: "1rem", fontWeight: 600, color: "#166534", marginBottom: "0.5rem" }}>
                ✅ Audio Recorded ({recordingSeconds > 0 ? `${recordingSeconds}s` : "File Ready"})
              </div>
              <div style={{ margin: "0 auto 1rem", maxWidth: 400 }}>
                <audio controls src={audioUrl} style={{ width: "100%" }} />
              </div>
              <div style={{ display: "flex", justifyContent: "center", gap: "0.75rem" }}>
                <button
                  type="button"
                  onClick={retakeRecording}
                  style={{
                    background: "#f1f5f9",
                    color: "#475569",
                    border: "1px solid #cbd5e1",
                    padding: "0.5rem 1rem",
                    borderRadius: "0.5rem",
                    fontSize: "0.85rem",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  🔄 Retake
                </button>
              </div>
            </div>
          ) : (
            <div>
              <div style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>🎙️</div>
              <p style={{ margin: "0 0 1rem", fontSize: "0.9rem", color: "#475569" }}>
                Click below to start recording when you are ready.
              </p>

              <div style={{ display: "flex", justifyContent: "center", gap: "1rem", flexWrap: "wrap" }}>
                {micSupported ? (
                  <button
                    type="button"
                    onClick={startRecording}
                    style={{
                      background: "#4f46e5",
                      color: "#fff",
                      border: "none",
                      padding: "0.7rem 1.5rem",
                      borderRadius: "0.5rem",
                      fontSize: "0.95rem",
                      fontWeight: 700,
                      cursor: "pointer",
                      boxShadow: "0 2px 5px rgba(79, 70, 229, 0.3)",
                    }}
                  >
                    🔴 Start Recording
                  </button>
                ) : (
                  <div style={{ color: "#b45309", fontSize: "0.85rem" }}>
                    ⚠️ Microphone recording unavailable in this browser environment. Please upload an audio file below.
                  </div>
                )}

                <label
                  style={{
                    background: "#f1f5f9",
                    color: "#334155",
                    border: "1px solid #cbd5e1",
                    padding: "0.7rem 1.25rem",
                    borderRadius: "0.5rem",
                    fontSize: "0.95rem",
                    fontWeight: 600,
                    cursor: "pointer",
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
                <div style={{ marginTop: "0.75rem", color: "#dc2626", fontSize: "0.8rem" }}>
                  ⚠️ {micError}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Optional Demographic Metadata */}
        <div
          style={{
            background: "#f8fafc",
            border: "1px solid #e2e8f0",
            borderRadius: "0.75rem",
            padding: "1.25rem",
            marginBottom: "1.5rem",
          }}
        >
          <div style={{ fontSize: "0.85rem", fontWeight: 700, color: "#334155", marginBottom: "0.25rem" }}>
            Demographic Slice (Strictly Optional)
          </div>
          <p style={{ margin: "0 0 0.75rem", fontSize: "0.75rem", color: "#64748b" }}>
            Used solely to evaluate dialectal representation and identify under-represented speaker cohorts.
            Never tied to your personal identity.
          </p>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.75rem" }}>
            <div>
              <label style={{ fontSize: "0.75rem", color: "#475569", display: "block", marginBottom: "0.2rem" }}>
                District
              </label>
              <input
                type="text"
                value={district}
                onChange={(e) => setDistrict(e.target.value)}
                placeholder="e.g. Pune, Bhojpur"
                style={{ width: "100%", padding: "0.4rem 0.5rem", borderRadius: "0.4rem", border: "1px solid #cbd5e1", fontSize: "0.82rem" }}
              />
            </div>
            <div>
              <label style={{ fontSize: "0.75rem", color: "#475569", display: "block", marginBottom: "0.2rem" }}>
                Gender
              </label>
              <select
                value={gender}
                onChange={(e) => setGender(e.target.value)}
                style={{ width: "100%", padding: "0.4rem 0.5rem", borderRadius: "0.4rem", border: "1px solid #cbd5e1", fontSize: "0.82rem" }}
              >
                <option value="">Prefer not to say</option>
                <option value="female">Female</option>
                <option value="male">Male</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: "0.75rem", color: "#475569", display: "block", marginBottom: "0.2rem" }}>
                Age Cohort
              </label>
              <select
                value={ageGroup}
                onChange={(e) => setAgeGroup(e.target.value)}
                style={{ width: "100%", padding: "0.4rem 0.5rem", borderRadius: "0.4rem", border: "1px solid #cbd5e1", fontSize: "0.82rem" }}
              >
                <option value="">Prefer not to say</option>
                <option value="18-30">18–30</option>
                <option value="31-50">31–50</option>
                <option value="51+">51+</option>
                <option value="under-18">Under 18 (requires parental consent)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Informed Consent & Safeguards */}
        <div
          style={{
            background: "#fffbeb",
            border: "1px solid #fde68a",
            borderRadius: "0.75rem",
            padding: "1.25rem",
            marginBottom: "1.5rem",
          }}
        >
          <div style={{ fontSize: "0.85rem", fontWeight: 700, color: "#92400e", marginBottom: "0.5rem" }}>
            🛡️ Informed Consent & Governance Notice (Policy v2.0)
          </div>
          <p style={{ margin: "0 0 0.75rem", fontSize: "0.78rem", color: "#78350f", lineHeight: 1.5 }}>
            • Your audio will be securely stored in private storage (never in a public directory).<br />
            • Recordings are reviewed by authorized human linguists to ensure accurate evaluation transcripts.<br />
            • Only approved records enter versioned open benchmarks; withdrawn records are immediately purged.<br />
            • You will receive a unique Deletion Token allowing you to delete your data at any time.
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            <label style={{ display: "flex", alignItems: "flex-start", gap: "0.5rem", fontSize: "0.82rem", color: "#78350f", cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={consentGiven}
                onChange={(e) => setConsentGiven(e.target.checked)}
                style={{ marginTop: "0.15rem" }}
              />
              <span>
                <strong>I give explicit informed consent</strong> for my voice recording and transcript to be analyzed and included in community benchmarks according to the governance policy.
              </span>
            </label>

            <label style={{ display: "flex", alignItems: "flex-start", gap: "0.5rem", fontSize: "0.82rem", color: "#78350f", cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={ageVerified}
                onChange={(e) => setAgeVerified(e.target.checked)}
                style={{ marginTop: "0.15rem" }}
              />
              <span>
                <strong>Age verification:</strong> I confirm I am 18 years or older, or have appropriate guardian consent to contribute.
              </span>
            </label>
          </div>
        </div>

        {/* Errors & Progress */}
        {errorMessage && (
          <div
            role="alert"
            style={{
              background: "#fef2f2",
              border: "1px solid #fca5a5",
              color: "#dc2626",
              padding: "0.75rem 1rem",
              borderRadius: "0.5rem",
              fontSize: "0.85rem",
              marginBottom: "1rem",
            }}
          >
            ⚠️ {errorMessage}
          </div>
        )}

        {uploadProgress && (
          <div style={{ color: "#4f46e5", fontSize: "0.85rem", marginBottom: "1rem", fontWeight: 600 }}>
            ⏳ {uploadProgress}
          </div>
        )}

        {/* Submit Button */}
        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitting || !audioBlob || !consentGiven || !ageVerified}
          style={{
            width: "100%",
            background: !audioBlob || !consentGiven || !ageVerified ? "#94a3b8" : "#4f46e5",
            color: "#fff",
            border: "none",
            padding: "0.85rem",
            borderRadius: "0.6rem",
            fontSize: "1rem",
            fontWeight: 700,
            cursor: !audioBlob || !consentGiven || !ageVerified ? "not-allowed" : "pointer",
            transition: "background 0.15s ease",
          }}
        >
          {submitting ? "Processing Contribution..." : "🚀 Submit Voice Contribution"}
        </button>
      </div>

      {/* Success Modal / Banner */}
      {successInfo && (
        <div
          style={{
            marginTop: "1.5rem",
            background: "#f0fdf4",
            border: "1px solid #86efac",
            borderRadius: "1rem",
            padding: "1.5rem",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.75rem" }}>
            <h3 style={{ margin: 0, color: "#166534", fontSize: "1.15rem", fontWeight: 700 }}>
              🎉 Thank You! Contribution Received
            </h3>
            <span
              style={{
                background: "#dcfce7",
                color: "#15803d",
                padding: "0.25rem 0.6rem",
                borderRadius: "0.35rem",
                fontSize: "0.75rem",
                fontWeight: 700,
              }}
            >
              Status: {successInfo.status}
            </span>
          </div>

          <p style={{ margin: "0 0 1rem", fontSize: "0.85rem", color: "#14532d" }}>
            Your contribution has been ingested into the human-review pipeline. An AI hypothesis has been generated for reviewer comparison.
          </p>

          <div
            style={{
              background: "#fff",
              border: "1px solid #bbf7d0",
              borderRadius: "0.5rem",
              padding: "1rem",
              fontSize: "0.85rem",
              marginBottom: "1rem",
            }}
          >
            {successInfo.reference && (
              <div style={{ marginBottom: "0.5rem" }}>
                <span style={{ color: "#64748b", fontWeight: 600 }}>Reference Transcript: </span>
                <span style={{ color: "#0f172a" }}>{successInfo.reference}</span>
              </div>
            )}
            <div>
              <span style={{ color: "#64748b", fontWeight: 600 }}>Initial ASR Hypothesis: </span>
              <span style={{ color: "#4f46e5", fontWeight: 600 }}>{successInfo.hypothesis}</span>
            </div>
            {successInfo.wer !== null && successInfo.wer !== undefined && (
              <div style={{ marginTop: "0.5rem", fontSize: "0.8rem", color: "#475569" }}>
                Unverified ASR WER: <strong>{successInfo.wer.toFixed(1)}%</strong> (pending human review confirmation)
              </div>
            )}
          </div>

          <div
            style={{
              background: "#f8fafc",
              border: "1px solid #e2e8f0",
              borderRadius: "0.5rem",
              padding: "0.75rem 1rem",
              fontSize: "0.78rem",
              marginBottom: "1rem",
            }}
          >
            <div><strong>Submission ID:</strong> <code>{successInfo.submissionId}</code></div>
            <div><strong>Deletion Secret Token:</strong> <code>{successInfo.deletionToken}</code></div>
            <div style={{ color: "#64748b", marginTop: "0.25rem" }}>
              Save your deletion token if you ever wish to exercise your right to erasure.
            </div>
          </div>

          {/* Right to erasure button */}
          <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
            <button
              type="button"
              onClick={handleWithdraw}
              disabled={withdrawing || successInfo.status === "WITHDRAWN"}
              style={{
                background: successInfo.status === "WITHDRAWN" ? "#e2e8f0" : "#fee2e2",
                color: successInfo.status === "WITHDRAWN" ? "#94a3b8" : "#991b1b",
                border: "1px solid #fca5a5",
                padding: "0.4rem 0.8rem",
                borderRadius: "0.4rem",
                fontSize: "0.78rem",
                fontWeight: 600,
                cursor: successInfo.status === "WITHDRAWN" ? "not-allowed" : "pointer",
              }}
            >
              {withdrawing ? "Purging Audio..." : successInfo.status === "WITHDRAWN" ? "Record Withdrawn" : "🗑️ Withdraw Recording Now"}
            </button>
            {withdrawMessage && (
              <span style={{ fontSize: "0.8rem", color: "#047857", fontWeight: 600 }}>
                {withdrawMessage}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
