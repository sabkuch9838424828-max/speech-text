// Typed API client for BhashaLens — v0.4
import type {
  WerResult,
  WerCellDetail,
  CoverageMatrix,
  SummaryStats,
  PrioritiesResponse,
  OverrideRequest,
  OverrideResponse,
  Thresholds,
  LanguageDistributionResponse,
  LanguageMatrixResponse,
  User,
  AuthResponse,
  UserStats,
  VoiceSubmission,
} from "../types";

const BASE_URL = "http://localhost:8000/api";

const TOKEN_KEY = "bhashalens_auth_token";

export function getStoredToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setStoredToken(token: string | null): void {
  try {
    if (token) {
      localStorage.setItem(TOKEN_KEY, token);
    } else {
      localStorage.removeItem(TOKEN_KEY);
    }
  } catch {
    // Ignore storage errors in restricted contexts
  }
}

function getAuthHeaders(): Record<string, string> {
  const token = getStoredToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  return headers;
}

async function get<T>(
  path: string,
  params?: Record<string, string | number | undefined>
): Promise<T> {
  const url = new URL(`${BASE_URL}${path}`);
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== "") {
        url.searchParams.set(k, String(v));
      }
    });
  }
  const res = await fetch(url.toString(), {
    method: "GET",
    headers: getAuthHeaders(),
    credentials: "include",
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(body.detail ?? `HTTP ${res.status}`);
  }
  return res.json();
}

async function post<T>(path: string, body: unknown, extraHeaders?: Record<string, string>): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: { ...getAuthHeaders(), ...(extraHeaders || {}) },
    credentials: "include",
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const b = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(b.detail ?? `HTTP ${res.status}`);
  }
  return res.json();
}

async function patch<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "PATCH",
    headers: getAuthHeaders(),
    credentials: "include",
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const b = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(b.detail ?? `HTTP ${res.status}`);
  }
  return res.json();
}

type ThresholdParams = {
  min_recordings?: number;
  min_reference_words?: number;
  high_wer_threshold?: number;
};

export const api = {
  health: () =>
    get<{ status: string; data_label: string; warning: string }>("/health"),

  districts: () => get<{ districts: string[] }>("/districts"),

  genders: () => get<{ genders: string[] }>("/genders"),

  ageGroups: () => get<{ age_groups: string[] }>("/age-groups"),

  /** Summary ribbon stats — threshold-sensitive */
  summary: (params?: ThresholdParams) =>
    get<SummaryStats>("/stats/summary", params as Record<string, number | undefined>),

  werOverview: (params?: ThresholdParams) =>
    get<WerResult[]>("/wer/overview", params as Record<string, number | undefined>),

  werDetail: (params: {
    district: string;
    gender?: string;
    age_group?: string;
  } & ThresholdParams) =>
    get<WerResult>("/wer/detail", params as Record<string, string | number | undefined>),

  /** Cell detail including naive_average_wer_pct for Math Modal */
  werCellDetail: (params: {
    district: string;
    gender: string;
    age_group: string;
  } & ThresholdParams) =>
    get<WerCellDetail>(
      "/wer/cell-detail",
      params as Record<string, string | number | undefined>
    ),

  coverageMatrix: (params?: ThresholdParams) =>
    get<CoverageMatrix>("/coverage/matrix", params as Record<string, number | undefined>),

  priorities: (params?: ThresholdParams) =>
    get<PrioritiesResponse>("/priorities", params as Record<string, number | undefined>),

  submitOverride: (payload: OverrideRequest) =>
    post<OverrideResponse>("/overrides", payload),

  submitFeedback: (payload: import("../types").FeedbackPayload) =>
    post<import("../types").FeedbackResponse>("/feedback", payload),

  /** Language distribution — filtered by district / gender / age_group */
  languageDistribution: (params?: {
    district?: string;
    gender?: string;
    age_group?: string;
  }) =>
    get<LanguageDistributionResponse>(
      "/language/distribution",
      params as Record<string, string | undefined>
    ),

  /** Full district × language × age matrix */
  languageMatrix: () => get<LanguageMatrixResponse>("/language/matrix"),

  /** Returns a URL string for CSV download (use window.open or anchor href) */
  manifestUrl: (thresholds?: Thresholds): string => {
    const url = new URL(`${BASE_URL}/export/manifest`);
    if (thresholds) {
      url.searchParams.set("min_recordings", String(thresholds.min_recordings));
      url.searchParams.set("min_reference_words", String(thresholds.min_reference_words));
      url.searchParams.set("high_wer_threshold", String(thresholds.high_wer_threshold));
    }
    return url.toString();
  },

  // ── BhashaLens 2.0 Community & Governance APIs ───────────────────────────

  prompts: (params?: { language?: string; dialect?: string }) =>
    get<{ prompts: import("../types").Prompt[] }>("/prompts", params),

  submitVoice: (payload: {
    contribution_mode: "guided" | "natural";
    language: string;
    dialect?: string;
    speech_context?: string;
    prompt_id?: string;
    reference_text?: string;
    district?: string;
    state?: string;
    gender?: string;
    age_group?: string;
    consent_given: boolean;
    age_verified: boolean;
    audio_base64: string;
    audio_filename?: string;
    content_type?: string;
  }) => post<any>("/submissions", payload),

  submissions: (params?: {
    status?: string;
    language?: string;
    limit?: number;
    offset?: number;
  }) =>
    get<{ submissions: import("../types").VoiceSubmission[] }>("/submissions", params),

  submissionDetails: (submissionId: string) =>
    get<import("../types").VoiceSubmission>(`/submissions/${submissionId}`),

  submissionAudioUrl: (submissionId: string, deletionToken?: string): string => {
    const url = new URL(`${BASE_URL}/submissions/${submissionId}/audio`);
    if (deletionToken) {
      url.searchParams.set("deletion_token", deletionToken);
    }
    return url.toString();
  },

  withdrawSubmission: (
    submissionId: string,
    deletionToken: string,
    reason?: string
  ) =>
    post<any>(`/submissions/${submissionId}/withdraw`, {
      submission_id: submissionId,
      deletion_token: deletionToken,
      reason: reason || "User requested withdrawal",
    }),

  reviewSubmission: (
    payload: {
      submission_id: string;
      reviewer_name: string;
      reviewer_role: string;
      action: "APPROVE" | "REJECT" | "CORRECT" | "REQUEST_REVIEW" | "EXCLUDE";
      corrected_transcript?: string;
      rejection_reason?: string;
      notes?: string;
    },
    reviewerRoleHeader?: string
  ) => {
    return fetch(`${BASE_URL}/review`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(reviewerRoleHeader ? { "X-Reviewer-Role": reviewerRoleHeader } : {}),
      },
      body: JSON.stringify(payload),
    }).then(async (res) => {
      if (!res.ok) {
        const b = await res.json().catch(() => ({ detail: res.statusText }));
        throw new Error(b.detail ?? `HTTP ${res.status}`);
      }
      return res.json();
    });
  },

  datasets: () =>
    get<{ datasets: import("../types").DatasetVersion[] }>("/datasets"),

  datasetDetails: (datasetId: string) =>
    get<import("../types").DatasetVersion>(`/datasets/${datasetId}`),

  publishDataset: (
    payload: {
      version: string;
      title: string;
      description: string;
      published_by: string;
      set_as_active_benchmark?: boolean;
    },
    reviewerRoleHeader = "admin"
  ) => {
    return fetch(`${BASE_URL}/datasets/publish`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Reviewer-Role": reviewerRoleHeader,
      },
      body: JSON.stringify(payload),
    }).then(async (res) => {
      if (!res.ok) {
        const b = await res.json().catch(() => ({ detail: res.statusText }));
        throw new Error(b.detail ?? `HTTP ${res.status}`);
      }
      return res.json();
    });
  },

  evaluations: () =>
    get<{ evaluations: import("../types").ModelEvaluation[] }>("/evaluations"),

  runEvaluation: (payload: {
    dataset_id: string;
    candidate_model_name: string;
    candidate_model_version: string;
    split_to_evaluate?: string;
    evaluated_by?: string;
    baseline_wer?: number;
  }) => post<any>("/evaluations/run", payload),

  promoteModel: (
    evaluationId: string,
    payload: {
      promoted_by: string;
      reviewer_role?: string;
    },
    reviewerRoleHeader = "admin"
  ) => {
    return fetch(`${BASE_URL}/evaluations/${evaluationId}/promote`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Reviewer-Role": reviewerRoleHeader,
      },
      body: JSON.stringify({
        evaluation_id: evaluationId,
        promoted_by: payload.promoted_by,
        reviewer_role: payload.reviewer_role || "admin",
      }),
    }).then(async (res) => {
      if (!res.ok) {
        const b = await res.json().catch(() => ({ detail: res.statusText }));
        throw new Error(b.detail ?? `HTTP ${res.status}`);
      }
      return res.json();
    });
  },

  communityStats: () =>
    get<import("../types").CommunityStats>("/stats/community"),

  // ── Authentication & User Portal Endpoints ─────────────────────────────────

  register: (payload: { name: string; email: string; password: string; role?: string }) =>
    post<AuthResponse>("/auth/register", payload),

  login: (payload: { email: string; password: string }) =>
    post<AuthResponse>("/auth/login", payload),

  logout: () => post<{ message: string }>("/auth/logout", {}),

  me: () => get<User>("/auth/me"),

  userStats: () => get<UserStats>("/user/stats"),

  userSubmissions: (params?: { limit?: number; offset?: number }) =>
    get<{ submissions: VoiceSubmission[] }>("/user/submissions", params),

  // ── Admin User Management ──────────────────────────────────────────────────

  adminUsers: (params?: { role?: string; is_active?: boolean; search?: string; limit?: number; offset?: number }) =>
    get<{ users: User[] }>("/admin/users", params as any),

  adminUpdateUserStatus: (userId: string, isActive: boolean) =>
    patch<{ id: string; email: string; is_active: boolean; updated: boolean }>(`/admin/users/${userId}/status`, { is_active: isActive }),

  adminUpdateUserRole: (userId: string, role: string) =>
    patch<{ id: string; email: string; role: string; updated: boolean }>(`/admin/users/${userId}/role`, { role }),
};
