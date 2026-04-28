export interface AnalyticsPeriod {
  start: string;
  end: string;
}

export interface AnalyticsCards {
  total_calls: number;
  avg_call_duration_seconds: number;
  review_completion_rate: number;
  avg_review_time_minutes: number;
}

export interface SankeyByIntent {
  total: number;
  transferred: number;
  transferred_extensions: Record<string, number>;
  non_transferred_intents: Record<string, number>;
}

export interface SankeyByDoctor {
  total: number;
  auto_reviewed: number;
  transferred: number;
  transferred_extensions: Record<string, number>;
  non_transferred_doctors: Record<string, number>;
  all_doctors: Record<string, number>;
}

export interface SankeyData {
  by_intent: SankeyByIntent;
  by_doctor: SankeyByDoctor;
}

export interface PerformerStats {
  user_name: string;
  reviews: number;
  percentage: number;
}

export interface DoctorBreakdownItem {
  doctor_name: string;
  total_calls: number;
  review_completion_rate: number;
  avg_review_time_minutes: number | null;
  needs_review: number;
  reviewed: number;
  performers: PerformerStats[];
}

export interface AnalyticsData {
  period: AnalyticsPeriod;
  cards: AnalyticsCards;
  sankey: SankeyData;
  doctor_breakdown: DoctorBreakdownItem[];
}
