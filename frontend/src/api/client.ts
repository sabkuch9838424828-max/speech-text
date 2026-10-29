// Typed API client for BhashaLens — v0.2
import type {
  WerResult,
  WerCellDetail,
  CoverageMatrix,
  SummaryStats,
  PrioritiesResponse,
  OverrideRequest,
  OverrideResponse,
  Thresholds,
} from "../types";

const BASE_URL = "http://localhost:8000/api";

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
};
