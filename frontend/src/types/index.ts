// BhashaLens type definitions
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

export interface CoverageCell {
  district: string;
  gender: string;
  age_group: string;
  status: CoverageStatus;
  recording_count: number;
}

export interface CoverageMatrix {
  cells: CoverageCell[];
  districts: string[];
  genders: string[];
  age_groups: string[];
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
  high_wer_threshold: 30,
};
