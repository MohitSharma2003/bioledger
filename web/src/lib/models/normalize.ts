import { UNKNOWN } from "../types";
import type { ParsedObservation } from "./types";

const MAX_TAG_LEN = 24;
const MAX_TAGS = 6;

function asString(value: unknown): string | null {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length ? trimmed : null;
  }
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return null;
}

function clampConfidence(value: unknown): number {
  const n = typeof value === "string" ? Number.parseFloat(value) : value;
  if (typeof n !== "number" || Number.isNaN(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

function asTags(value: unknown): string[] {
  const list = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(/[,;]/)
      : [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of list) {
    const tag = asString(item)?.toLowerCase().replace(/\s+/g, " ").slice(0, MAX_TAG_LEN);
    if (tag && !seen.has(tag)) {
      seen.add(tag);
      out.push(tag);
    }
    if (out.length >= MAX_TAGS) break;
  }
  return out;
}

/**
 * Force any provider's raw output into the one shape the store and UI expect.
 * Runs at the provider boundary so a badly-behaved model cannot reach the
 * database, and never invents a species name.
 */
export function normalizeObservation(raw: unknown): ParsedObservation {
  const data = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const species = asString(data.species) ?? UNKNOWN;
  return {
    species,
    common_name: asString(data.common_name),
    category: asString(data.category)?.toLowerCase() ?? "other",
    confidence: clampConfidence(data.confidence),
    note: asString(data.note) ?? "",
    tags: asTags(data.tags),
    season_note: asString(data.season_note),
  };
}

/**
 * Pull the first JSON object out of a model reply. Small models add prose or
 * code fences around the object, so we brace-match rather than trusting trim.
 */
export function extractJson(text: string): unknown | null {
  if (!text) return null;
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = fenced ? fenced[1] : text;
  const start = body.indexOf("{");
  if (start === -1) return null;
  let depth = 0;
  for (let i = start; i < body.length; i += 1) {
    const ch = body[i];
    if (ch === "{") depth += 1;
    else if (ch === "}") {
      depth -= 1;
      if (depth === 0) {
        try {
          return JSON.parse(body.slice(start, i + 1));
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}
