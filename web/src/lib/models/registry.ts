import { MODEL_CATALOG } from "./catalog";
import type { ModelDescriptor } from "./types";

/**
 * Bioledger offers two model options, and they have different roles:
 *
 *  - "Gemma3:4B" is the default for this computer. It runs on the local Ollama
 *    server and is what the app uses out of the box. The desktop path never
 *    needs the optional model.
 *  - "Gemma 4 E2B (for mobile)" is optional. It runs entirely in the browser
 *    (Transformers.js on WebGPU) and is only downloaded or initialized after
 *    the user explicitly selects it. It is never a fallback for the desktop
 *    model.
 */

export const DESKTOP_MODEL_LABEL = "Gemma3:4B";
export const DESKTOP_MODEL_SUBTITLE = "Default · This computer · Ollama";
export const MOBILE_MODEL_LABEL = "Gemma 4 E2B (for mobile)";
export const MOBILE_MODEL_SUBTITLE = "Optional · Browser-local inference";

/** The Ollama tag for the default desktop model. */
export const OLLAMA_MODEL_ID = "gemma3:4b";

/** The community ONNX build Transformers.js loads in the browser. */
export const GEMMA4_E2B_ONNX_ID = "onnx-community/gemma-4-E2B-it-ONNX";

/**
 * Size of the q4f16 weight subset, read from the Hugging Face API for this
 * exact repo revision. Reported to the user before they consent to a download.
 */
export const GEMMA4_E2B_ONNX_BYTES = 3_381_966_758;

/**
 * The browser models come straight from the verified catalog: whatever is
 * listed there has been proven to download and load. Adding to the AI Model
 * Browser means adding a verified entry to `catalog.ts`, nothing else.
 */
export const BROWSER_MODELS: ModelDescriptor[] = MODEL_CATALOG.map((m) => ({
  id: m.id,
  provider: "browser",
  runtime: m.runtime,
  label: MOBILE_MODEL_LABEL,
  subtitle: MOBILE_MODEL_SUBTITLE,
  text: m.text,
  vision: m.vision,
  sizeBytes: m.sizeBytes,
  license: m.license,
  note: m.note,
}));

/** Shown before the server reports its own model ids. */
export const OLLAMA_MODELS: ModelDescriptor[] = [
  {
    id: OLLAMA_MODEL_ID,
    provider: "ollama",
    runtime: "ollama",
    label: DESKTOP_MODEL_LABEL,
    subtitle: DESKTOP_MODEL_SUBTITLE,
    text: true,
    vision: true,
    note: "Default. Writes field notes and reads photos through Ollama.",
  },
];

export function browserModel(id: string): ModelDescriptor | undefined {
  return BROWSER_MODELS.find((m) => m.id === id);
}

/** Display label and subtitle for a server-reported Ollama model. */
export function desktopModel(id: string): { label: string; subtitle: string } {
  if (id === OLLAMA_MODEL_ID) {
    return { label: DESKTOP_MODEL_LABEL, subtitle: DESKTOP_MODEL_SUBTITLE };
  }
  return { label: id, subtitle: "This computer · Ollama" };
}

export function formatBytes(bytes: number | undefined): string {
  if (!bytes || bytes <= 0) return "unknown size";
  const gb = bytes / (1024 * 1024 * 1024);
  if (gb >= 1) return `${gb.toFixed(2)} GB`;
  const mb = bytes / (1024 * 1024);
  return `${Math.round(mb)} MB`;
}
