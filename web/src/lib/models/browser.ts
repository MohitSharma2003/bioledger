import { api } from "../api";
import type { Observation } from "../types";
import { GEMMA4_E2B_ONNX_ID, browserModel, formatBytes } from "./registry";
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
 * Gemma 4 E2B, running entirely in the browser with Transformers.js on WebGPU.
 *
 * The q4f16 weights are about 3.2 GB and are fetched once from the Hugging Face
 * hub, then cached by the browser so later runs work offline. This runtime
 * requires WebGPU: the same model on the WASM backend would be impractically
 * slow, so we report it as unsupported rather than pretend otherwise.
 */

const MODEL_ID = GEMMA4_E2B_ONNX_ID;

// Set once the weights have been fetched and verified, so that after a reload
// (or a relaunch of the installed app) the UI can say "downloaded, load it"
// instead of pretending the 3.2 GB download has to happen all over again.
const CACHED_KEY = "bioledger.browser.cached";

function wasCached(): boolean {
  try {
    return typeof localStorage !== "undefined" && localStorage.getItem(CACHED_KEY) === "1";
  } catch {
    return false;
  }
}

function markCached(): void {
  try {
    if (typeof localStorage !== "undefined") localStorage.setItem(CACHED_KEY, "1");
  } catch {
    /* storage may be blocked; the download still works, only the hint is lost */
  }
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

function webgpuAvailable(): boolean {
  if (!isBrowser()) return false;
  const nav = navigator as Navigator & { gpu?: unknown };
  return Boolean(nav.gpu);
}

function classifyError(error: unknown): ModelStatus {
  const detail = error instanceof Error ? error.message : String(error);
  if (/out of memory|allocation failed|failed to allocate|\boom\b|aborted/i.test(detail)) {
    return { kind: "out_of_memory", detail };
  }
  if (/webgpu|gpuadapter|adapter/i.test(detail)) {
    return { kind: "unsupported", detail };
  }
  return { kind: "error", detail };
}

/** Load the processor and model once, verify it, and share the promise. */
async function load(request: ReadyRequest): Promise<Bundle> {
  if (loaded && bundle) return bundle;
  if (loadPromise) return loadPromise;

  loading = true;
  cancelled = false;
  lastError = null;

  loadPromise = (async () => {
    const mod = (await import("@huggingface/transformers")) as unknown as AnyRecord;
    const env = mod.env as AnyRecord;
    env.allowLocalModels = false;
    env.useBrowserCache = true;

    const device: InferenceDevice = request.device ?? "webgpu";
    const processor = await mod.AutoProcessor.from_pretrained(MODEL_ID);
    const model = await mod.Gemma4ForConditionalGeneration.from_pretrained(MODEL_ID, {
      dtype: "q4f16",
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
    await verify(ready);
    if (cancelled) throw new Error("Download cancelled.");
    markCached();
    bundle = ready;
    loaded = true;
    loading = false;
    return ready;
  } catch (error) {
    loadPromise = null;
    bundle = null;
    loaded = false;
    loading = false;
    lastError = cancelled ? null : classifyError(error);
    throw error;
  }
}

/** A real one-line generation, so "ready" means the model actually works. */
async function verify(ready: Bundle): Promise<void> {
  const reply = await generate(ready, "", "Reply with the single word: ready", null, 8);
  if (!reply) throw new Error("Gemma 4 E2B loaded but produced no test output.");
}

async function generate(
  ready: Bundle,
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
  // The system turn must be plain text: Gemma's chat template trims the first
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

function photoNotice(error: unknown): string {
  const detail = error instanceof Error ? error.message : String(error);
  if (!webgpuAvailable()) {
    return "This browser has no WebGPU, so Gemma 4 E2B could not run here. The sighting was saved as written.";
  }
  return `Gemma 4 E2B could not finish reading this just now (${detail}). The sighting was saved as written.`;
}

export const browserProvider: ModelProvider = {
  id: "browser",
  label: "This browser",
  runtime: "transformers.js",
  location: "client",
  models: () => [browserModel(MODEL_ID)!],

  async status(modelId: string): Promise<ModelStatus> {
    if (!isBrowser()) return { kind: "unsupported", detail: "Not running in a browser." };
    if (loaded && bundle) return { kind: "offline_ready", detail: "Loaded and ready, works offline." };
    if (loading) return { kind: "initializing", detail: "Loading Gemma 4 E2B..." };
    if (lastError) return lastError;
    if (!webgpuAvailable()) {
      return {
        kind: "unsupported",
        detail: "This browser has no WebGPU, so Gemma 4 E2B cannot run here.",
      };
    }
    const descriptor = browserModel(modelId);
    if (wasCached()) {
      return {
        kind: "cached",
        detail: "Downloaded to this app already. Loading it from local storage takes a few seconds.",
      };
    }
    return {
      kind: "download_required",
      detail: `One-time download of about ${formatBytes(descriptor?.sizeBytes)}.`,
    };
  },

  async ensureReady(_modelId: string, request: ReadyRequest): Promise<void> {
    await load(request);
  },

  async parse(input: ObserveInput, _modelId: string, request: ReadyRequest): Promise<ObserveResponse> {
    const text = input.text.trim();
    let parsed: ParsedObservation;
    let notice: string | null = null;
    let aiProcessed = true;
    let imageUrl: string | null = null;

    try {
      if (input.photo) imageUrl = URL.createObjectURL(input.photo);
      const ready = await load(request);
      const prompt =
        `Observation: ${text}\n` +
        (input.place?.trim() ? `Place: ${input.place.trim()}\n` : "") +
        "Return the JSON object.";
      const reply = await generate(ready, PARSE_SYSTEM, prompt, imageUrl, 320);
      const json = extractJson(reply);
      parsed = normalizeObservation(json ?? {});
      if (!json) {
        aiProcessed = false;
        notice = "Gemma 4 E2B replied in a form I could not read, so the note was saved as written.";
      }
    } catch (error) {
      aiProcessed = false;
      parsed = normalizeObservation({});
      notice = photoNotice(error);
    } finally {
      if (imageUrl) URL.revokeObjectURL(imageUrl);
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
      used_vision: Boolean(input.photo) && aiProcessed,
      ai_processed: aiProcessed,
      notice,
    };
  },

  async answer(question: string, _modelId: string, request: ReadyRequest): Promise<AskOut> {
    const entries = await context();
    let reply = "";
    try {
      const ready = await load(request);
      reply = await generate(
        ready,
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
          "Gemma 4 E2B could not answer just now. Your journal is still saved; try again when the model is loaded.",
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
    loaded = false;
  },

  release(): void {
    loadPromise = null;
    bundle = null;
    loaded = false;
    loading = false;
    cancelled = false;
    lastError = null;
  },
};
