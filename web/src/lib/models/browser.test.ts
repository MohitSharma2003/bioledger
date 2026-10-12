/**
 * Failure-isolation tests for the optional browser runtime.
 *
 * These mock the network and the model library, so a failed download, a
 * cancelled download, a failed initialisation, and a failed inference are all
 * exercised deterministically. The point of each test is the same: the
 * optional model can fail without taking the default desktop path down.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const hf = vi.hoisted(() => {
  const processor = Object.assign(vi.fn(), {
    apply_chat_template: vi.fn(),
    batch_decode: vi.fn(),
  });
  const model = { generate: vi.fn() };
  return {
    env: {},
    processor,
    model,
    load_image: vi.fn(),
    AutoProcessor: { from_pretrained: vi.fn() },
    Gemma4ForConditionalGeneration: { from_pretrained: vi.fn() },
  };
});

const apiMock = vi.hoisted(() => ({
  health: vi.fn(),
  observe: vi.fn(),
  ask: vi.fn(),
  observations: vi.fn(),
  season: vi.fn(),
  saveObservation: vi.fn(),
  attachPhoto: vi.fn(),
}));

vi.mock("@huggingface/transformers", () => hf);
vi.mock("../api", () => ({ api: apiMock }));

import { browserProvider } from "./browser";
import { ollamaProvider } from "./ollama";
import { OLLAMA_MODEL_ID } from "./registry";
import type { Observation } from "../types";

const READY_STATUS = {
  app: "Bioledger",
  backend: "sqlite",
  ollama: true,
  model: "gemma3:4b",
  model_present: true,
  embed_model: "nomic-embed-text",
  embed_present: true,
  vision_model: "gemma3:4b",
  vision_present: true,
};

function savedObservation(): Observation {
  return {
    id: 1,
    created_at: new Date().toISOString(),
    text: "A beetle on a leaf.",
    species: "Ivy",
    category: "plant",
    confidence: 0.5,
    note: "",
    tags: [],
    source: "user",
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  browserProvider.release();
  vi.stubGlobal("window", {});
  vi.stubGlobal("navigator", { gpu: { requestAdapter: async () => ({}) } });

  hf.processor.apply_chat_template.mockReturnValue("prompt");
  hf.processor.mockResolvedValue({ input_ids: { dims: [1, 5] } });
  hf.processor.batch_decode.mockReturnValue(["ready"]);
  hf.model.generate.mockResolvedValue({ slice: () => "sliced" });
  hf.AutoProcessor.from_pretrained.mockResolvedValue(hf.processor);
  hf.Gemma4ForConditionalGeneration.from_pretrained.mockResolvedValue(hf.model);

  apiMock.health.mockResolvedValue(READY_STATUS);
  apiMock.saveObservation.mockResolvedValue(savedObservation());
  apiMock.season.mockResolvedValue({ month: 1, species: [] });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("browser runtime status", () => {
  it("is unsupported when WebGPU is absent, and never ready", async () => {
    vi.stubGlobal("navigator", {});
    expect((await browserProvider.status("m")).kind).toBe("unsupported");
  });

  it("requires an explicit download before it is ready", async () => {
    expect((await browserProvider.status("m")).kind).toBe("download_required");
  });

  it("remembers a finished download and offers to load instead of re-downloading", async () => {
    const store = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => (store.has(key) ? store.get(key)! : null),
      setItem: (key: string, value: string) => void store.set(key, String(value)),
      removeItem: (key: string) => void store.delete(key),
    });

    await browserProvider.ensureReady("m", {});
    browserProvider.release(); // simulate closing and reopening the installed app

    expect((await browserProvider.status("m")).kind).toBe("cached");
  });
});

describe("browser model download management", () => {
  it("remembers each model's cached state separately", async () => {
    const store = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => (store.has(key) ? store.get(key)! : null),
      setItem: (key: string, value: string) => void store.set(key, String(value)),
      removeItem: (key: string) => void store.delete(key),
    });

    await browserProvider.ensureReady("m", {});
    browserProvider.release();

    // The downloaded model is cached; an unrelated repo id is not.
    expect((await browserProvider.status("m")).kind).toBe("cached");
    expect((await browserProvider.status("onnx-community/some-other-repo")).kind).toBe(
      "download_required",
    );
  });

  it("deleteDownload clears the cached state so the model needs re-downloading", async () => {
    const store = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => (store.has(key) ? store.get(key)! : null),
      setItem: (key: string, value: string) => void store.set(key, String(value)),
      removeItem: (key: string) => void store.delete(key),
    });

    await browserProvider.ensureReady("m", {});
    browserProvider.release();
    expect((await browserProvider.status("m")).kind).toBe("cached");

    await browserProvider.deleteDownload?.("m");
    expect((await browserProvider.status("m")).kind).toBe("download_required");
    expect(store.size).toBe(0);
  });

  it("a cancelled download reports cancelled, not ready", async () => {
    let resolveProcessor: (value: unknown) => void = () => {};
    hf.AutoProcessor.from_pretrained.mockReturnValue(
      new Promise((resolve) => {
        resolveProcessor = resolve;
      }),
    );

    const pending = browserProvider.ensureReady("m", {});
    browserProvider.cancel?.();
    resolveProcessor(hf.processor);

    await expect(pending).rejects.toThrow(/cancel/i);
    expect((await browserProvider.status("m")).kind).not.toBe("offline_ready");
  });

  it("registers a storage-quota failure as a clear error, not a fake ready", async () => {
    hf.AutoProcessor.from_pretrained.mockRejectedValue(
      new Error("QuotaExceededError: no space on device"),
    );
    await expect(browserProvider.ensureReady("m", {})).rejects.toThrow(/quota/i);
    expect((await browserProvider.status("m")).kind).toBe("error");
    expect((await browserProvider.status("m")).detail).toMatch(/storage/i);
  });

  it("never claims vision for the text-only browser model", async () => {
    await browserProvider.ensureReady("m", {});
    hf.processor.batch_decode.mockReturnValue([
      JSON.stringify({ species: "Ivy", category: "plant", confidence: 0.5, note: "On a leaf." }),
    ]);
    const result = await browserProvider.parse(
      { text: "A beetle on a leaf.", photo: { name: "leaf.jpg" } as unknown as File },
      "m",
      {},
    );
    expect(result.used_vision).toBe(false);
    expect(result.notice).toMatch(/cannot read photos/i);
    expect(apiMock.saveObservation).toHaveBeenCalledOnce();
  });
});

describe("failure isolation", () => {
  it("a failed download leaves the desktop model working", async () => {
    hf.AutoProcessor.from_pretrained.mockRejectedValue(new Error("network down"));

    await expect(browserProvider.ensureReady("m", {})).rejects.toThrow(/network down/);
    expect((await browserProvider.status("m")).kind).toBe("error");

    // The default path is untouched by the optional model's failure.
    const ollama = await ollamaProvider.status(OLLAMA_MODEL_ID);
    expect(ollama.kind).toBe("ready");
  });

  it("a failure reports error and stays unready", async () => {
    hf.processor.mockRejectedValue(new Error("bad tensor"));

    await expect(browserProvider.ensureReady("m", {})).rejects.toThrow(/bad tensor/);
    expect((await browserProvider.status("m")).kind).toBe("error");
  });

  it("an inference failure still saves the sighting and does not break Ollama", async () => {
    await browserProvider.ensureReady("m", {});
    expect((await browserProvider.status("m")).kind).toBe("offline_ready");

    // Break generation after the model is loaded.
    hf.processor.mockRejectedValue(new Error("runtime error"));

    const result = await browserProvider.parse(
      { text: "A beetle on a leaf." },
      "m",
      {},
    );
    expect(result.ai_processed).toBe(false);
    expect(result.observation.text).toContain("beetle");
    expect(apiMock.saveObservation).toHaveBeenCalledOnce();

    const ollama = await ollamaProvider.status(OLLAMA_MODEL_ID);
    expect(ollama.kind).toBe("ready");
  });
});
