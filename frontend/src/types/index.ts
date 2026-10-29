// BhashaLens type definitions — v0.2
// ⚠ All data is ILLUSTRATIVE DEMO DATA

export type WerStatus =
  | "no_data"
  | "insufficient"
  | "cannot_calculate"
  | "high_wer"
  | "ok";

export type CoverageStatus = "no_data" | "insufficient" | "ok";

export interface WerResult {
  district: string;
  gender: string | null;
  age_group: string | null;
  status: WerStatus;
  wer_pct: number | null;
  recording_count: number;
  reference_word_count: number;
  substitutions: number;
  deletions: number;
  insertions: number;
  threshold_min_recordings: number;
  threshold_min_words: number;
}

export interface WerCellDetail {
  district: string;
  gender: string;
  age_group: string;
  status: WerStatus;
  wer_pct: number | null;
  naive_average_wer_pct: number | null;
  recording_count: number;
  reference_word_count: number;
  substitutions: number;
  deletions: number;
  insertions: number;
}

export interface CoverageCell {
  district: string;
  gender: string;
  age_group: string;
  status: WerStatus;
  recording_count: number;
  reference_word_count: number;
  wer_pct: number | null;
  substitutions: number;
  deletions: number;
  insertions: number;
}

export interface CoverageMatrix {
  cells: CoverageCell[];
  districts: string[];
  genders: string[];
  age_groups: string[];
}

export interface SummaryStats {
  total_districts: number;
  total_cohort_cells: number;
  validated_cohorts: number;
  validated_pct: number;
  high_wer_alerts: number;
  high_wer_pct: number;
  blindspots: number;
  blindspots_pct: number;
  insufficient_evidence: number;
  cannot_calculate: number;
  field_deficit_recordings: number;
  recommended_target_per_cell: number;
}

export interface CollectionPriority {
  rank: number;
  district: string;
  gender: string;
  age_group: string;
  reason: string;
  gap_type: "missing" | "insufficient" | "high_wer";
  recording_count: number;
  recommended_target: number;
  community_override?: OverrideData | null;
}

export interface PrioritiesResponse {
  priorities: CollectionPriority[];
  thresholds: {
    min_recordings: number;
    high_wer_threshold: number;
    recommended_target: number;
  };
  disclaimer: string;
}

export interface OverrideData {
  cell_id: string;
  custom_target: number | null;
  qualitative_tag: string;
  notes: string;
  reviewer_name: string;
  reviewer_role: string;
  submitted_at: string;
}

export interface OverrideRequest {
  cell_id: string;
  custom_target?: number;
  qualitative_tag: string;
  notes: string;
  reviewer_name: string;
  reviewer_role: string;
}

export interface OverrideResponse {
  accepted: boolean;
  message: string;
  cell_id: string;
}

export interface FeedbackPayload {
  cell_id: string;
  comment: string;
  reviewer: string;
  agreed_with_priority?: boolean;
}

export interface FeedbackResponse {
  accepted: boolean;
  message: string;
}

export interface Thresholds {
  min_recordings: number;
  min_reference_words: number;
  high_wer_threshold: number;
}

export const DEFAULT_THRESHOLDS: Thresholds = {
  min_recordings: 5,
  min_reference_words: 20,
  high_wer_threshold: 25,
};

// ── Language distribution types ───────────────────────────────────────────────

export interface LanguageAgeBreakdown {
  recording_count: number;
  wer_pct: number | null;
  reference_word_count: number;
  substitutions: number;
  deletions: number;
  insertions: number;
}

export interface LanguageStat {
  language: string;
  recording_count: number;
  reference_word_count: number;
  substitutions: number;
  deletions: number;
  insertions: number;
  wer_pct: number | null;
  breakdown_by_age: Record<string, LanguageAgeBreakdown>;
  breakdown_by_district: Record<string, { recording_count: number; wer_pct: number | null }>;
}

export interface LanguageDistributionResponse {
  languages: LanguageStat[];
  total_recordings: number;
  unique_languages: number;
  filters_applied: { district: string | null; gender: string | null; age_group: string | null };
  data_label: string;
}

export interface LanguageMatrixCell {
  district: string;
  language: string;
  age_group: string;
  recording_count: number;
  wer_pct: number | null;
  reference_word_count: number;
  substitutions: number;
  deletions: number;
  insertions: number;
}

export interface LanguageMatrixResponse {
  cells: LanguageMatrixCell[];
  districts: string[];
  languages: string[];
  age_groups: string[];
  data_label: string;
}

// ── BhashaLens 2.0 Community & Governance Types ──────────────────────────────

export interface Prompt {
  id: string;
  language: string;
  dialect?: string | null;
  text: string;
  difficulty?: string;
  domain?: string;
}

export interface ReviewHistoryEntry {
  id: number;
  submission_id: string;
  reviewer_name: string;
  reviewer_role: string;
  action: string;
  prior_status: string;
  new_status: string;
  prior_transcript: string | null;
  new_transcript: string | null;
  reason: string | null;
  notes: string | null;
  timestamp: string;
}

export interface VoiceSubmission {
  id: string;
  deletion_token: string;
  contribution_mode: "guided" | "natural";
  language: string;
  dialect?: string | null;
  speech_context?: string | null;
  prompt_id?: string | null;
  reference_text?: string | null;
  hypothesis_text?: string | null;
  model_name?: string | null;
  model_version?: string | null;
  confidence_score?: number | null;
  audio_storage_path?: string;
  audio_filename: string;
  audio_format: string;
  audio_size_bytes: number;
  audio_duration_sec: number;
  duplicate_of_id?: string | null;
  quality_flags_json?: string;
  substitutions: number;
  deletions: number;
  insertions: number;
  reference_word_count: number;
  wer_pct: number | null;
  wer_status: string;
  district?: string | null;
  state?: string | null;
  gender?: string | null;
  age_group?: string | null;
  status:
    | "RECEIVED"
    | "VALIDATION_FAILED"
    | "READY_FOR_ANALYSIS"
    | "ANALYZED"
    | "PENDING_REVIEW"
    | "APPROVED"
    | "REJECTED"
    | "NEEDS_CORRECTION"
    | "WITHDRAWN";
  review_priority: number;
  is_excluded: number;
  created_at: string;
  updated_at: string;
  history?: ReviewHistoryEntry[];
}

export interface DatasetVersion {
  id: string;
  version: string;
  title: string;
  description: string;
  total_records: number;
  language_breakdown: Record<string, number>;
  published_by: string;
  published_at: string;
  is_active_benchmark: number;
  splits?: Record<string, number>;
  items_preview?: Array<{
    id: number;
    split: string;
    approved_text: string;
    language: string;
    dialect?: string | null;
    district?: string | null;
    gender?: string | null;
    age_group?: string | null;
    audio_duration_sec: number;
    wer_pct: number | null;
  }>;
}

export interface ModelEvaluation {
  id: string;
  candidate_model_name: string;
  candidate_model_version: string;
  dataset_id: string;
  dataset_version?: string;
  split_evaluated: string;
  total_samples: number;
  overall_wer: number | null;
  baseline_wer: number | null;
  wer_delta: number | null;
  sample_limitation_warning?: string | null;
  evaluated_by: string;
  evaluated_at: string;
  is_promoted: number;
  promoted_by?: string | null;
  promoted_at?: string | null;
  metrics?: {
    substitutions: number;
    deletions: number;
    insertions: number;
    reference_words: number;
    per_language: Record<
      string,
      {
        subs: number;
        dels: number;
        inss: number;
        ref_words: number;
        samples: number;
        wer_pct: number | null;
      }
    >;
  };
}

export interface CommunityStats {
  total_submissions: number;
  pending_reviews: number;
  approved_submissions: number;
  rejected_submissions: number;
  needs_correction: number;
  withdrawn_submissions: number;
  with_reference_transcript: number;
  without_reference_transcript: number;
  language_coverage: Array<{ language: string; count: number; approved_count: number }>;
  quality_flags_distribution: Record<string, number>;
  verified_wer_pct: number | null;
  verified_wer_status: string;
  verified_recordings_count: number;
  substitutions: number;
  deletions: number;
  insertions: number;
  reference_word_count: number;
  active_benchmark_version: string;
  last_publication_timestamp: string | null;
}

// ── Auth & User Portal Types ────────────────────────────────────────────────

export type UserRole = "USER" | "ADMIN" | "REVIEWER";

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  is_active: boolean;
  created_at: string;
  last_login_at?: string | null;
}

export interface AuthResponse {
  user: User;
  token: string;
  message: string;
}

export interface UserStats {
  total_submissions: number;
  pending_review: number;
  approved: number;
  needs_correction: number;
  withdrawn: number;
}


