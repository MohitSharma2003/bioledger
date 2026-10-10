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

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(path, options);
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
  season: () => request<{ species: SeasonRow[] }>("/api/season"),
  categories: () =>
    request<{ categories: CategoryCount[] }>("/api/categories"),
  observations: (params: ObservationQuery = {}) =>
    request<Observation[]>(`/api/observations?${toQuery(params)}`),
  observation: (id: number) => request<Observation>(`/api/observations/${id}`),
  observe: (form: FormData) =>
    request<ObserveResponse>("/api/observe", { method: "POST", body: form }),
  ask: (question: string) =>
    request<AskOut>("/api/ask", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question }),
    }),
  seed: () => request<{ seeded: number }>("/api/seed", { method: "POST" }),
};
