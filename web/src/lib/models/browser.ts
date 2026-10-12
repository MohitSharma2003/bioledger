import { api } from "../api";
import type { Observation } from "../types";
import { GEMMA4_E2B_ONNX_ID, browserModel, formatBytes } from "./registry";
import { catalogModel, defaultCatalogModel, type CatalogModel } from "./catalog";
import { extractJson, normalizeObservation } from "./normalize";
import { enqueue, syntheticObservation } from "./outbox";
import { putPhoto } from "../photos";
import type {
  AskOut,
  InferenceDevice,
  ModelProvider,
  ModelStatus,
  NewObservationInput,
  ObserveInput,
  ObserveResponse,
  ParsedObservation,
  ReadyRequest,
} from "./types";

/**
 * Browser-local inference with Transformers.js.
 *
 * Models come from the verified catalog in `catalog.ts`. Once a model's
 * weights are fetched from the Hugging Face hub they are cached by the runtime,
 * so later runs (including offline) reuse them. Each model's cached state is
 * remembered per repo id so a page reload can say "downloaded, load it"
 * instead of pretending the download has to happen again.
 */

const MODEL_ID = GEMMA4_E2B_ONNX_ID;

function entryFor(id: string): CatalogModel {
  return catalogModel(id) ?? defaultCatalogModel();
}

const CACHED_PREFIX = "bioledger.browser.cached";

function cacheKey(id: string): string {
  return `${CACHED_PREFIX}.${id}`;
}

function wasCached(id: string): boolean {
  try {
    return typeof localStorage !== "undefined" && localStorage.getItem(cacheKey(id)) === "1";
  } catch {
    return false;
  }
}

function markCached(id: string): void {
  try {
    if (typeof localStorage !== "undefined") localStorage.setItem(cacheKey(id), "1");
  } catch {
    /* storage may be blocked; the download still works, only the hint is lost */
  }
}

function clearCached(id: string): void {
  try {
    if (typeof localStorage !== "undefined") localStorage.removeItem(cacheKey(id));
  } catch {
    /* storage may be blocked */
  }
}

/** Pure cache-state lookup, so the UI can render "downloaded" after a reload. */
export function hadCachedDownload(id: string): boolean {
  return wasCached(id);
}

// The library ships its own types; we treat the handles as opaque here so this
// file does not fight the tensor types.
type AnyRecord = Record<string, any>;
interface Bundle {
  // The library owns these types and they are large; we keep the handles opaque.
  processor: any;
  model: any;
}

let bundle: Bundle | null = null;
let loadPromise: Promise<Bundle> | null = null;
let loaded = false;
let loading = false;
let cancelled = false;
let lastError: ModelStatus | null = null;
let loadedModelId: string | null = null;

const PARSE_SYSTEM =
  "You turn one plain nature observation into a single JSON object. " +
  "Reply with JSON only, no prose, no code fences. Keys: " +
  "species (string), common_name (string or null), category (one of: bird, insect, " +
  "plant, fungus, mammal, amphibian, reptile, fish, cloud, other), confidence " +
  "(number from 0 to 1), note (one short sentence), tags (array of up to six short " +
  "lowercase words), season_note (one short sentence or null). If you cannot " +
  "identify a species, use \"unidentified sighting\" with a low confidence. Never " +
  "invent a species name you are unsure of.";

const ANSWER_SYSTEM =
  "You answer questions about the user's own nature journal. Use only the " +
  "entries given to you. If they do not contain the answer, say so plainly. " +
  "Keep the answer to a few sentences.";

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof navigator !== "undefined";
}

/** Drop the in-memory model; cached weights and cache flags stay untouched. */
function releaseRuntime(): void {
  loadPromise = null;
  bundle = null;
  loadedModelId = null;
  loaded = false;
  loading = false;
  cancelled = false;
  lastError = null;
}

function webgpuAvailable(): boolean {
  if (!isBrowser()) return false;
  const nav = navigator as Navigator & { gpu?: unknown };
  return Boolean(nav.gpu);
}

function classifyError(error: unknown, entry: CatalogModel): ModelStatus {
  const detail = error instanceof Error ? error.message : String(error);
  if (/quota|no space|not enough space|storage/i.test(detail)) {
    return {
      kind: "error",
      detail: `The browser refused the download (${detail}). The device may be low on storage, or storage is blocked.`,
    };
  }
  if (/out of memory|allocation failed|failed to allocate|\boom\b|aborted/i.test(detail)) {
    return { kind: "out_of_memory", detail };
  }
  if (/webgpu|gpuadapter|adapter/i.test(detail)) {
    return {
      kind: "unsupported",
      detail: `${entry.name} needs ${entry.devices.join("/")}, which this browser did not offer (${detail}).`,
    };
  }
  return { kind: "error", detail };
}

/** Load the processor and model once, verify it, and share the promise. */
export async function load(request: ReadyRequest, modelId: string): Promise<Bundle> {
  const entry = entryFor(modelId);
  if (loaded && bundle && loadedModelId === modelId) return bundle;
  if (loaded && bundle && loadedModelId !== modelId) releaseRuntime();
  if (loadPromise) return loadPromise;

  loading = true;
  cancelled = false;
  lastError = null;

  loadPromise = (async () => {
    const mod = (await import("@huggingface/transformers")) as unknown as AnyRecord;
    const env = mod.env as AnyRecord;
    env.allowLocalModels = false;
    env.useBrowserCache = true;

    const device: InferenceDevice = request.device ?? entry.devices[0] ?? "webgpu";
    const processor = await mod.AutoProcessor.from_pretrained(entry.id);
    const model = await mod[entry.className].from_pretrained(entry.id, {
      dtype: entry.dtype,
      device,
      progress_callback: (info: AnyRecord) => {
        if (cancelled || !request.onProgress) return;
        if (info.status === "progress_total" && typeof info.progress === "number") {
          request.onProgress({
            kind: "downloading",
            progress: info.progress / 100,
            detail: typeof info.file === "string" ? info.file : undefined,
          });
        } else if (info.status === "ready") {
          request.onProgress({ kind: "initializing" });
        }
      },
    });
    return { processor, model } as Bundle;
  })();

  try {
    const ready = await loadPromise;
    if (cancelled) throw new Error("Download cancelled.");
    await verify(ready, entry);
    if (cancelled) throw new Error("Download cancelled.");
    markCached(modelId);
    bundle = ready;
    loadedModelId = modelId;
    loaded = true;
    loading = false;
    lastError = null;
    return ready;
  } catch (error) {
    loadPromise = null;
    bundle = null;
    loadedModelId = null;
    loaded = false;
    loading = false;
    lastError = cancelled ? null : classifyError(error, entry);
    throw error;
  }
}

/** A real one-line generation, so "ready" means the model actually works. */
async function verify(ready: Bundle, entry: CatalogModel): Promise<void> {
  const reply = await generate(ready, entry, "", "Reply with the single word: ready", null, 8);
  if (!reply) throw new Error(`${entry.name} loaded but produced no test output.`);
}

async function generate(
  ready: Bundle,
  entry: CatalogModel,
  system: string,
  user: string,
  imageUrl: string | null,
  maxNewTokens: number,
): Promise<string> {
  const mod = (await import("@huggingface/transformers")) as unknown as AnyRecord;
  const content: AnyRecord[] = [];
  if (imageUrl) content.push({ type: "image" });
  content.push({ type: "text", text: user });

  const messages: AnyRecord[] = [];
  // The system turn must be plain text: the chat template trims the first
  // message's content, and "trim" cannot operate on a multimodal content array.
  if (system) messages.push({ role: "system", content: system });
  messages.push({ role: "user", content });

  const prompt = ready.processor.apply_chat_template(messages, {
    enable_thinking: false,
    add_generation_prompt: true,
  });

  const image = imageUrl ? await mod.load_image(imageUrl) : null;
  const inputs = await ready.processor(prompt, image, null, { add_special_tokens: false });
  const outputs = await ready.model.generate({
    ...inputs,
    max_new_tokens: maxNewTokens,
    do_sample: false,
  });

  const promptLength = inputs.input_ids.dims.at(-1);
  const decoded = ready.processor.batch_decode(
    outputs.slice(null, [promptLength, null]),
    { skip_special_tokens: true },
  );
  return (decoded?.[0] ?? "").trim();
}

async function save(payload: NewObservationInput, photo: File | null): Promise<Observation> {
  try {
    let saved = await api.saveObservation(payload);
    if (photo && saved.id > 0) {
      try {
        // The server keeps the photo; the returned record carries its URL.
        saved = await api.attachPhoto(saved.id, photo);
      } catch {
        // The record is safe; keep the photo locally so it is not lost.
        await putPhoto(saved.id, photo).catch(() => undefined);
      }
    }
    return saved;
  } catch {
    // The server is unreachable. Keep the sighting in the IndexedDB outbox so
    // it is never lost, and render a local stand-in for now.
    await enqueue(payload);
    const synthetic = syntheticObservation(payload);
    if (photo) await putPhoto(synthetic.id, photo).catch(() => undefined);
    return synthetic;
  }
}

async function context(): Promise<string> {
  try {
    const rows = await api.observations({ limit: 40 });
    if (!rows.length) return "(the journal is empty)";
    return rows
      .map((r) => `- ${r.created_at.slice(0, 10)} [${r.category}] ${r.species}: ${r.note || r.text}`)
      .join("\n");
  } catch {
    return "(the journal could not be read)";
  }
}

/** Best-effort removal of a model's cached files from the Cache Storage API. */
async function pruneModelFiles(repoId: string): Promise<void> {
  if (typeof caches === "undefined") return;
  const suffix = repoId.replace("/", "--");
  try {
    const names = await caches.keys();
    for (const name of names) {
      const cache = await caches.open(name);
      const requests = await cache.keys();
      for (const request of requests) {
        if (request.url.includes(suffix)) await cache.delete(request);
      }
    }
  } catch {
    /* best-effort: some browsers lock or evict caches; the flag is removed anyway */
  }
}

export const browserProvider: ModelProvider = {
  id: "browser",
  label: "This browser",
  runtime: "transformers.js",
  location: "client",
  models: () => [browserModel(MODEL_ID)!],

  async status(modelId: string): Promise<ModelStatus> {
    const entry = entryFor(modelId);
    if (!isBrowser()) return { kind: "unsupported", detail: "Not running in a browser." };
    if (loaded && bundle && loadedModelId === modelId) {
      return { kind: "offline_ready", detail: `${entry.name} is loaded and ready, and works offline.` };
    }
    if (loading) return { kind: "initializing", detail: `Loading ${entry.name}...` };
    if (lastError) return lastError;
    if (!webgpuAvailable()) {
      return {
        kind: "unsupported",
        detail: `This browser has no WebGPU, so ${entry.name} cannot run here.`,
      };
    }
    if (wasCached(modelId)) {
      return {
        kind: "cached",
        detail: `${entry.name} is downloaded to this app already. Loading it from local storage takes a few seconds.`,
      };
    }
    return {
      kind: "download_required",
      detail: `One-time download of about ${formatBytes(entry.sizeBytes)}, then cached for offline use.`,
    };
  },

  async ensureReady(modelId: string, request: ReadyRequest): Promise<void> {
    await load(request, modelId);
  },

  async parse(input: ObserveInput, modelId: string, request: ReadyRequest): Promise<ObserveResponse> {
    const entry = entryFor(modelId);
    const text = input.text.trim();
    let parsed: ParsedObservation;
    let notice: string | null = null;
    let aiProcessed = true;

    try {
      const ready = await load(request, modelId);
      const prompt =
        `Observation: ${text}\n` +
        (input.place?.trim() ? `Place: ${input.place.trim()}\n` : "") +
        "Return the JSON object.";
      // Text-only model: never route a photo into it. The photo is still saved
      // with the note, but nothing here pretends the model read it.
      const reply = await generate(ready, entry, PARSE_SYSTEM, prompt, null, 320);
      const json = extractJson(reply);
      parsed = normalizeObservation(json ?? {});
      if (!json) {
        aiProcessed = false;
        notice = `${entry.name} replied in a form I could not read, so the note was saved as written.`;
      } else if (input.photo) {
        notice =
          "The browser model cannot read photos yet. Your photo is saved with the note; the note's text specialists did the writing.";
      }
    } catch (error) {
      aiProcessed = false;
      parsed = normalizeObservation({});
      notice = photoNotice(entry, error);
    }

    const saved = await save(
      {
        text,
        place: input.place?.trim() || null,
        ...parsed,
        source: "user",
      },
      input.photo ?? null,
    );

    let season: ObserveResponse["in_season"] = [];
    try {
      season = (await api.season()).species ?? [];
    } catch {
      /* season is a nice-to-have here */
    }

    return {
      observation: saved,
      similar: [],
      in_season: season,
      used_vision: false,
      ai_processed: aiProcessed,
      notice,
    };
  },

  async answer(question: string, modelId: string, request: ReadyRequest): Promise<AskOut> {
    const entry = entryFor(modelId);
    const entries = await context();
    let reply = "";
    try {
      const ready = await load(request, modelId);
      reply = await generate(
        ready,
        entry,
        ANSWER_SYSTEM,
        `Journal entries:\n${entries}\n\nQuestion: ${question}`,
        null,
        320,
      );
    } catch {
      reply = "";
    }
    let sources: Observation[] = [];
    try {
      sources = await api.observations({ limit: 40 });
    } catch {
      /* leave sources empty */
    }
    if (!reply) {
      return {
        answer:
          `${entry.name} could not answer just now. Your journal is still saved; try again when the model is loaded.`,
        sources: [],
        mode: "offline",
      };
    }
    return { answer: reply, sources, mode: "browser" };
  },

  cancel(): void {
    if (!loading) return;
    cancelled = true;
    loading = false;
    lastError = null;
    loadPromise = null;
    bundle = null;
    loadedModelId = null;
    loaded = false;
  },

  async deleteDownload(modelId: string): Promise<void> {
    clearCached(modelId);
    const entry = entryFor(modelId);
    if (loaded && loadedModelId === modelId) {
      releaseRuntime();
    }
    await pruneModelFiles(entry.id);
  },

  release(): void {
    releaseRuntime();
  },
};

function photoNotice(entry: CatalogModel, error: unknown): string {
  const detail = error instanceof Error ? error.message : String(error);
  if (!webgpuAvailable()) {
    return `This browser has no WebGPU, so ${entry.name} could not run here. The sighting was saved as written.`;
  }
  return `${entry.name} could not finish reading this just now (${detail}). The sighting was saved as written.`;
}