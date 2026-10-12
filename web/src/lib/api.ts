import type {
  AskOut,
  CategoryCount,
  Health,
  Observation,
  ObserveResponse,
  SeasonRow,
  Stats,
  TimelineDay,
} from "./types";
import type { NewObservationInput, ServerProvider } from "./models/types";

// Production API origin, if the UI and API do not share one origin. Empty by
// default (same-origin requests, or a proxy like the Vercel rewrite forwards
// /api on the same origin). Set VITE_API_BASE at build time only when the API is
// served from a different host and you also configure BIOLEDGER_PUBLIC_BASE and
// BIOLEDGER_CORS_ORIGINS on it.
const API_BASE = String((import.meta.env as Record<string, string | undefined>).VITE_API_BASE ?? "").replace(/\/$/, "");

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(API_BASE + path, options);
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      detail = body.detail || detail;
    } catch {
      /* keep statusText */
    }
    throw new Error(detail);
  }
  if (res.status === 204) return null as T;
  return (await res.json()) as T;
}

export interface ObservationQuery {
  limit?: number;
  q?: string;
  category?: string;
}

function toQuery(params: ObservationQuery): string {
  const search = new URLSearchParams();
  search.set("limit", String(params.limit ?? 100));
  if (params.q) search.set("q", params.q);
  if (params.category) search.set("category", params.category);
  return search.toString();
}

export const api = {
  health: () => request<Health>("/api/health"),
  stats: () => request<Stats>("/api/stats"),
  timeline: (days = 30) =>
    request<{ days: TimelineDay[] }>(`/api/timeline?days=${days}`),
  season: () => request<{ month: number; species: SeasonRow[] }>("/api/season"),
  categories: () =>
    request<{ categories: CategoryCount[] }>("/api/categories"),
  observations: (params: ObservationQuery = {}) =>
    request<Observation[]>(`/api/observations?${toQuery(params)}`),
  observation: (id: number) => request<Observation>(`/api/observations/${id}`),
  observe: (form: FormData) =>
    request<ObserveResponse>("/api/observe", { method: "POST", body: form }),
  models: () => request<{ providers: ServerProvider[] }>("/api/models"),
  saveObservation: (payload: NewObservationInput) =>
    request<Observation>("/api/observations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),
  attachPhoto: (id: number, photo: File | Blob) => {
    const form = new FormData();
    form.set("photo", photo);
    return request<Observation>(`/api/observations/${id}/photo`, {
      method: "POST",
      body: form,
    });
  },
  ask: (question: string) =>
    request<AskOut>("/api/ask", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question }),
    }),
  seed: () => request<{ seeded: number }>("/api/seed", { method: "POST" }),
};
