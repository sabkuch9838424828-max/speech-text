// Typed API client for BhashaLens backend
import type {
  WerResult,
  CoverageMatrix,
  PrioritiesResponse,
  FeedbackPayload,
  FeedbackResponse,
} from "../types";

const BASE_URL = "http://localhost:8000/api";

async function get<T>(path: string, params?: Record<string, string | number | undefined>): Promise<T> {
  const url = new URL(`${BASE_URL}${path}`);
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== "") {
        url.searchParams.set(k, String(v));
      }
    });
  }
  const res = await fetch(url.toString());
  if (!res.ok) {
    const body = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(body.detail ?? `HTTP ${res.status}`);
  }
  return res.json();
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const b = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(b.detail ?? `HTTP ${res.status}`);
  }
  return res.json();
}

export const api = {
  health: () => get<{ status: string; data_label: string; warning: string }>("/health"),

  districts: () => get<{ districts: string[] }>("/districts"),

  genders: () => get<{ genders: string[] }>("/genders"),

  ageGroups: () => get<{ age_groups: string[] }>("/age-groups"),

  werOverview: (params?: {
    min_recordings?: number;
    min_reference_words?: number;
    high_wer_threshold?: number;
  }) => get<WerResult[]>("/wer/overview", params as Record<string, number | undefined>),

  werDetail: (params: {
    district: string;
    gender?: string;
    age_group?: string;
    min_recordings?: number;
    min_reference_words?: number;
    high_wer_threshold?: number;
  }) => get<WerResult>("/wer/detail", params as Record<string, string | number | undefined>),

  coverageMatrix: (params?: { min_recordings?: number }) =>
    get<CoverageMatrix>("/coverage/matrix", params as Record<string, number | undefined>),

  priorities: (params?: {
    min_recordings?: number;
    high_wer_threshold?: number;
  }) => get<PrioritiesResponse>("/priorities", params as Record<string, number | undefined>),

  submitFeedback: (payload: FeedbackPayload) =>
    post<FeedbackResponse>("/feedback", payload),
};
