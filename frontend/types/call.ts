export enum CallStatus {
  QUEUED = "QUEUED",
  IN_PROGRESS = "IN_PROGRESS",
  COMPLETED = "COMPLETED",
  FAILED = "FAILED",
  ABANDONED = "ABANDONED",
}

export enum ExtractionStatus {
  PENDING = "PENDING",
  IN_PROGRESS = "IN_PROGRESS",
  COMPLETED = "COMPLETED",
  FAILED = "FAILED",
  SKIPPED = "SKIPPED",
}

export interface DisplayData {
  caller_name?: string;
  patient_name?: string;
  patient_dob?: string;
  phone_number?: string;
  duration_seconds?: number;
  caller_affiliation?: string;
  provider_name?: string;
  primary_intent?: string;
  priority?: string;
  summary?: string;
  call_teams?: string[];
}

export interface ExtractionData {
  caller_name?: string;
  caller_affiliation?: string;
  patient_dob?: string;
  patient_name?: string;
  provider_name?: string;
  primary_intent?: string;
  priority?: string;
  summary?: string;
  call_teams?: string[];
  auto_review?: boolean;
}

export interface VapiStructuredData {
  caller_name?: string;
  caller_affiliation?: string;
  patient_dob?: string;
  patient_name?: string;
  provider_name?: string;
  primary_intent?: string;
  priority?: string;
  summary?: string;
  callback_number?: string;
  subject_name?: string;
  dob?: string;
  priority_level?: string;
  free_text_summary?: string;
}

export interface VapiAnalysis {
  structuredData?: VapiStructuredData;
  summary?: string;
}

export interface VapiArtifact {
  recordingUrl?: string;
  transcript?: string;
}

export interface VapiCall {
  id?: string;
  customer?: {
    number?: string;
  };
  durationSeconds?: number;
}

export interface VapiData {
  call?: VapiCall;
  analysis?: VapiAnalysis;
  artifact?: VapiArtifact;
  recordingUrl?: string;
  durationSeconds?: number;
  cost?: number;
}

export interface Call {
  id: string;
  twilio_call_sid: string;
  vapi_call_id: string | null;
  display_data: DisplayData | null;
  vapi_data?: VapiData | null;
  extraction_data?: ExtractionData | null;
  extraction_status?: ExtractionStatus | null;
  status: CallStatus;
  is_reviewed: boolean;
  reviewed_by: string | null;
  reviewed_at: string | null;
  is_flagged: boolean;
  flagged_by: string | null;
  flagged_at: string | null;
  created_at: string;
  updated_at: string;
}

export type CallDetail = Call;

export interface SearchResult extends CallDetail {
  relevance_score: number;
  is_top_result: boolean;
}

export interface CallSearchRequest {
  query: string;
  start_date?: string;
  end_date?: string;
  status?: CallStatus;
  is_reviewed?: boolean;
  limit?: number;
  offset?: number;
}

export interface CallSearchResult {
  calls: CallDetail[];
  total: number;
}

export interface CallComment {
  id: string;
  call_id: string;
  user_id: string | null;
  user_name: string | null;
  content: string;
  created_at: string;
}
