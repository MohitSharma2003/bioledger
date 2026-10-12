import type { AskOut, Observation, ObserveResponse, SimilarResult } from "../types";

export type ProviderId = "ollama" | "browser";
export type ProviderRuntime = "ollama" | "transformers.js";
export type ProviderLocation = "server" | "client";
export type InferenceDevice = "webgpu" | "wasm";

export interface ModelDescriptor {
  id: string;
  provider: ProviderId;
  runtime: ProviderRuntime;
  label: string;
  /** One-line role/context line, e.g. "Default · This computer · Ollama". */
  subtitle?: string;
  /** Offline text generation. */
  text: boolean;
  /** Can read an attached photo. */
  vision: boolean;
  /** Approximate download size, when the runtime downloads weights. */
  sizeBytes?: number;
  license?: string;
  note?: string;
}

/** Only states the app can actually observe. */
export type StatusKind =
  | "ready"
  | "checking"
  | "not_installed"
  | "offline"
  | "download_required"
  | "cached"
  | "downloading"
  | "initializing"
  | "unsupported"
  | "out_of_memory"
  | "offline_ready"
  | "error"
  | "unverified"
  | "unknown";

export interface ModelStatus {
  kind: StatusKind;
  detail?: string;
  /** 0..1 during a download. */
  progress?: number;
}

export interface ServerProvider {
  id: ProviderId;
  label: string;
  runtime: ProviderRuntime;
  location: ProviderLocation;
  endpoint: string | null;
  status: ModelStatus;
  models: ServerModel[];
}

export interface ServerModel {
  id: string;
  label: string;
  role: "text" | "embedding";
  vision: boolean;
  present: boolean;
  license?: string;
}

export interface ObserveInput {
  text: string;
  place?: string;
  photo?: File | null;
}

/** Body for POST /api/observations, used by the browser runtime's save path. */
export interface NewObservationInput {
  text: string;
  place?: string | null;
  lat?: number | null;
  lon?: number | null;
  species?: string;
  common_name?: string | null;
  category?: string;
  confidence?: number;
  note?: string;
  tags?: string[];
  season_note?: string | null;
  source?: string;
}

export interface ReadyRequest {
  device?: InferenceDevice;
  onProgress?: (status: ModelStatus) => void;
}

export interface ParsedObservation {
  species: string;
  common_name: string | null;
  category: string;
  confidence: number;
  note: string;
  tags: string[];
  season_note: string | null;
}

/**
 * Every runtime the UI can drive implements this. Inference details (a server
 * round-trip versus an in-browser model) stay behind it, so the pages never
 * branch on which model is active.
 */
export interface ModelProvider {
  id: ProviderId;
  label: string;
  runtime: ProviderRuntime;
  location: ProviderLocation;
  models: () => ModelDescriptor[];
  status: (modelId: string) => Promise<ModelStatus>;
  ensureReady: (modelId: string, request: ReadyRequest) => Promise<void>;
  parse: (input: ObserveInput, modelId: string, request: ReadyRequest) => Promise<ObserveResponse>;
  answer: (question: string, modelId: string, request: ReadyRequest) => Promise<AskOut>;
  /** Abort an in-progress download/initialisation, where the runtime allows it. */
  cancel?: () => void;
  release: () => void;
}

export type { AskOut, Observation, ObserveResponse, SimilarResult };
