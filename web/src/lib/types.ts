export interface Observation {
  id: number;
  created_at: string;
  text: string;
  place?: string | null;
  lat?: number | null;
  lon?: number | null;
  species: string;
  common_name?: string | null;
  category: string;
  confidence: number;
  note: string;
  tags: string[];
  season_note?: string | null;
}

export interface SimilarResult {
  observation: Observation;
  score: number;
}

export interface ObserveResponse {
  observation: Observation;
  similar: SimilarResult[];
  in_season: { species: string; count: number }[];
  used_vision: boolean;
  ai_processed: boolean;
  notice?: string | null;
}

export interface Stats {
  total: number;
  species: number;
  this_week: number;
  streak_days: number;
  top_species: { species: string; count: number }[];
}

export interface TimelineDay {
  date: string;
  count: number;
}

export interface CategoryCount {
  category: string;
  count: number;
}

export interface SeasonRow {
  species: string;
  count: number;
}

export interface Health {
  app: string;
  backend: string;
  ollama: boolean;
  model: string;
  model_present: boolean;
  embed_model: string;
  embed_present: boolean;
  vision_model: string;
  vision_present: boolean;
}

export interface AskOut {
  answer: string;
  sources: Observation[];
  mode: string;
}

export const UNKNOWN = "unidentified sighting";
