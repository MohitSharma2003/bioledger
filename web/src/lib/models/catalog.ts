/**
 * The in-app model library ("AI Model Browser").
 *
 * Every entry here has been verified to actually download and load through
 * Transformers.js in a real browser before it is listed. A HF repo that merely
 * looks interesting is never listed: an entry that cannot load would look
 * functional and then fail, which is exactly what this catalog exists to
 * prevent.
 *
 * Add a new model only after it has been verified end-to-end (weights fetch,
 * in-memory load, and a real generation). Until then, leave it out.
 */

export type ModelTask =
  | "text" // text generation
  | "extraction" // structured observation extraction
  | "qa" // question answering over the user's journal
  | "vision"; // image understanding (a separate, compatible vision model)

export const MODEL_TASK_LABELS: Record<ModelTask, string> = {
  text: "Text generation",
  extraction: "Structured observation extraction",
  qa: "Question answering",
  vision: "Image understanding",
};

/** Filter chips the AI Model Browser offers, in display order. */
export const MODEL_TASK_FILTERS: { task: ModelTask; slug: string }[] = [
  { task: "text", slug: "text" },
  { task: "extraction", slug: "extraction" },
  { task: "qa", slug: "qa" },
  { task: "vision", slug: "vision" },
];

export type RuntimeDevice = "webgpu" | "wasm";

export const RUNTIME_DEVICE_LABELS: Record<RuntimeDevice, string> = {
  webgpu: "WebGPU (GPU inside the browser)",
  wasm: "CPU (WebAssembly)",
};

export interface CatalogModel {
  /** Hugging Face repository id, used as the runtime's model id. */
  id: string;
  name: string;
  publisher: string;
  runtime: "transformers.js";
  /** Devices this model has actually been verified on. */
  devices: RuntimeDevice[];
  tasks: ModelTask[];
  text: boolean;
  vision: boolean;
  /** Verified weight size (q4f16 subset), read from the HF API. */
  sizeBytes: number;
  license: string;
  licenseNote?: string;
  /** Human-readable hardware expectations, from the verified runs. */
  hardware: string;
  /** True only after a real browser verified fetch + load + generation. */
  verified: boolean;
  verifiedDetail?: string;
  recommended: boolean;
  note: string;
  hfUrl: string;
  /** Transformers.js entry point that reads this repo. */
  className: string;
  /** Quantization dtype verified for this model. */
  dtype: string;
}

export const MODEL_CATALOG: CatalogModel[] = [
  {
    id: "onnx-community/gemma-4-E2B-it-ONNX",
    name: "Gemma 4 E2B",
    publisher: "Google · ONNX build by onnx-community",
    runtime: "transformers.js",
    devices: ["webgpu"],
    tasks: ["text", "extraction", "qa"],
    text: true,
    vision: false,
    sizeBytes: 3_381_966_758,
    license: "Apache-2.0",
    licenseNote:
      "Apache-2.0. On-device use and field-note writing are allowed.",
    hardware:
      "WebGPU in a recent Chrome or Edge. About 4 GB+ of device memory is recommended for the 3.15 GB q4f16 weights.",
    verified: true,
    verifiedDetail:
      "Full download, load, and a real field note verified in this browser (WebGPU, q4f16).",
    recommended: true,
    note:
      "Text-only: it writes field notes and answers journal questions, but cannot read photos.",
    hfUrl: "https://huggingface.co/onnx-community/gemma-4-E2B-it-ONNX",
    className: "Gemma4ForConditionalGeneration",
    dtype: "q4f16",
  },
];

/** Look up a catalog entry by repo id, with a safe default when absent. */
export function catalogModel(id: string): CatalogModel | undefined {
  return MODEL_CATALOG.find((m) => m.id === id);
}

export function defaultCatalogModel(): CatalogModel {
  return MODEL_CATALOG[0];
}