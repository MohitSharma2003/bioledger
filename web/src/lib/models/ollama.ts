import { api } from "../api";
import { OLLAMA_MODELS } from "./registry";
import type {
  AskOut,
  ModelProvider,
  ModelStatus,
  ObserveInput,
  ObserveResponse,
  ReadyRequest,
} from "./types";

/**
 * The default runtime: the Bioledger server calls a local Ollama instance.
 * All model work happens behind the API, so this provider just forwards.
 */
export const ollamaProvider: ModelProvider = {
  id: "ollama",
  label: "Ollama on this computer",
  runtime: "ollama",
  location: "server",
  models: () => OLLAMA_MODELS,

  async status(modelId: string): Promise<ModelStatus> {
    try {
      const health = await api.health();
      if (!health.ollama) {
        return { kind: "not_installed", detail: "Ollama is not running." };
      }
      if (modelId === health.embed_model) {
        return health.embed_present
          ? { kind: "ready" }
          : { kind: "not_installed", detail: `${modelId} is not installed.` };
      }
      // The default desktop model. The optional browser model is a separate
      // runtime and is never substituted here.
      if (health.model_present) {
        return { kind: "ready", detail: `${modelId} is running locally.` };
      }
      return {
        kind: "not_installed",
        detail: `${modelId} is not installed. Run: ollama pull ${health.model}`,
      };
    } catch {
      return { kind: "error", detail: "Cannot reach the Bioledger server." };
    }
  },

  async ensureReady(): Promise<void> {
    // The server owns Ollama; there is nothing to download in the browser.
  },

  async parse(input: ObserveInput, _modelId: string, _request: ReadyRequest): Promise<ObserveResponse> {
    const form = new FormData();
    form.set("text", input.text.trim());
    if (input.place?.trim()) form.set("place", input.place.trim());
    if (input.photo) form.set("photo", input.photo);
    return api.observe(form);
  },

  async answer(question: string, _modelId: string, _request: ReadyRequest): Promise<AskOut> {
    return api.ask(question);
  },

  release(): void {
    /* nothing held in the browser */
  },
};
