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
