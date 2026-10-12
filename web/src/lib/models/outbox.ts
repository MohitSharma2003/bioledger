import { api } from "../api";
import type { Observation } from "../types";
import type { NewObservationInput } from "./types";

/**
 * A small IndexedDB outbox. If the server cannot be reached when the browser
 * runtime finishes a sighting, the observation is queued here instead of being
 * lost, then sent the next time the app can reach the API. This is the
 * offline-first fallback; the server's SQLite remains the source of truth.
 */

const DB_NAME = "bioledger";
const STORE = "outbox";
const VERSION = 1;

interface PendingItem {
  key?: number;
  payload: NewObservationInput;
  created_at: string;
}

function hasIDB(): boolean {
  return typeof indexedDB !== "undefined";
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "key", autoIncrement: true });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function run<T>(
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await openDb();
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const request = fn(tx.objectStore(STORE));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    tx.oncomplete = () => db.close();
  });
}

/** A local stand-in so the UI can render the sighting immediately, offline. */
export function syntheticObservation(payload: NewObservationInput): Observation {
  return {
    id: -Math.floor(Math.random() * 2 ** 31),
    created_at: new Date().toISOString(),
    text: payload.text,
    place: payload.place ?? null,
    lat: payload.lat ?? null,
    lon: payload.lon ?? null,
    species: payload.species ?? "unidentified sighting",
    common_name: payload.common_name ?? null,
    category: payload.category ?? "other",
    confidence: payload.confidence ?? 0,
    note: payload.note ?? "",
    tags: payload.tags ?? [],
    season_note: payload.season_note ?? null,
    source: payload.source ?? "user",
  };
}

export async function enqueue(payload: NewObservationInput): Promise<void> {
  if (!hasIDB()) return;
  const item: PendingItem = { payload, created_at: new Date().toISOString() };
  await run("readwrite", (store) => store.add(item));
}

export async function pending(): Promise<number> {
  if (!hasIDB()) return 0;
  try {
    const count = await run<number>("readonly", (store) => store.count());
    return count;
  } catch {
    return 0;
  }
}

/**
 * Try to send everything queued in the outbox. Returns how many were sent and
 * how many remain; a network failure leaves the rest for the next attempt.
 */
export async function flush(): Promise<{ sent: number; remaining: number }> {
  if (!hasIDB()) return { sent: 0, remaining: 0 };
  let items: PendingItem[] = [];
  try {
    items = await run<PendingItem[]>("readonly", (store) => store.getAll());
  } catch {
    return { sent: 0, remaining: 0 };
  }
  let sent = 0;
  for (const item of items) {
    if (item.key === undefined) continue;
    try {
      await api.saveObservation(item.payload);
      await run("readwrite", (store) => store.delete(item.key as number));
      sent += 1;
    } catch {
      break; // still offline; keep the rest queued in order
    }
  }
  return { sent, remaining: items.length - sent };
}
