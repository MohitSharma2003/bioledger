import type { InferenceDevice } from "./types";

export interface CapabilityReport {
  webgpu: boolean;
  wasm: boolean;
  crossOriginIsolated: boolean;
  /**
   * `navigator.deviceMemory` is a coarse, capped browser hint (rounded to a
   * power of two, max 8). When the browser does not expose it we report
   * `null` rather than guessing, per the spec.
   */
  deviceMemoryGB: number | null;
  storageQuotaBytes: number | null;
  storageUsageBytes: number | null;
  persistentStorage: boolean;
  canRunBrowserModel: boolean;
  reasons: string[];
}

const EMPTY: CapabilityReport = {
  webgpu: false,
  wasm: false,
  crossOriginIsolated: false,
  deviceMemoryGB: null,
  storageQuotaBytes: null,
  storageUsageBytes: null,
  persistentStorage: false,
  canRunBrowserModel: false,
  reasons: [],
};

function deviceMemoryGB(): number | null {
  const nav = navigator as Navigator & { deviceMemory?: number };
  const value = nav.deviceMemory;
  return typeof value === "number" && value > 0 ? value : null;
}

interface GpuProbe {
  gpu?: { requestAdapter?: () => Promise<unknown> };
}

/** Probe the browser without blocking the UI; called once and cached. */
export async function detectCapability(): Promise<CapabilityReport> {
  if (typeof navigator === "undefined") return EMPTY;

  const reasons: string[] = [];
  const wasm = typeof WebAssembly === "object";

  let webgpu = false;
  const gpu = (navigator as Navigator & GpuProbe).gpu;
  if (gpu && typeof gpu.requestAdapter === "function") {
    try {
      const adapter = await gpu.requestAdapter();
      webgpu = Boolean(adapter);
    } catch {
      webgpu = false;
    }
  }
  if (webgpu) reasons.push("WebGPU available, using the fast path.");
  else reasons.push(
    "No WebGPU. This browser cannot run the optional mobile model, which needs GPU acceleration.",
  );

  const memory = deviceMemoryGB();
  if (memory === null) reasons.push("Available memory is unknown to the browser.");
  else if (memory < 4)
    reasons.push(`Browser reports roughly ${memory} GB RAM; the mobile model may not fit.`);

  let storageQuotaBytes: number | null = null;
  let storageUsageBytes: number | null = null;
  let persistentStorage = false;
  const storage = navigator.storage;
  if (storage?.estimate) {
    try {
      const est = await storage.estimate();
      storageQuotaBytes = est.quota ?? null;
      storageUsageBytes = est.usage ?? null;
    } catch {
      /* leave null */
    }
  }
  if (storage?.persisted) {
    try {
      persistentStorage = await storage.persisted();
    } catch {
      /* leave false */
    }
  }

  // The optional mobile model only runs on WebGPU here: the q4f16 weights are
  // about 3.2 GB, which is not practical to run on the WASM backend on a phone.
  // We report unsupported rather than pretend a much slower path exists.
  const canRunBrowserModel = webgpu;
  const isolated =
    typeof self !== "undefined" &&
    Boolean((self as unknown as { crossOriginIsolated?: boolean }).crossOriginIsolated);
  return {
    webgpu,
    wasm,
    crossOriginIsolated: isolated,
    deviceMemoryGB: memory,
    storageQuotaBytes,
    storageUsageBytes,
    persistentStorage,
    canRunBrowserModel,
    reasons,
  };
}

export function preferredDevice(report: CapabilityReport | null): InferenceDevice {
  return "webgpu";
}

export interface Recommendation {
  providerId: "ollama" | "browser" | "unsupported";
  reason: string;
}

/**
 * Recommend a runtime from real capability, not the user agent. The desktop
 * Ollama model is the default and always wins when it is ready; the optional
 * mobile model is only suggested when the server is unreachable.
 */
export function recommend(
  report: CapabilityReport | null,
  serverReady: boolean,
): Recommendation {
  if (serverReady) {
    return { providerId: "ollama", reason: "Gemma3:4B is already running through Ollama." };
  }
  if (report?.canRunBrowserModel) {
    return {
      providerId: "browser",
      reason: "Ollama is unavailable. This browser can run the optional mobile model on WebGPU.",
    };
  }
  return {
    providerId: "unsupported",
    reason: "No usable runtime on this device. The desktop model needs Ollama; the mobile model needs WebGPU.",
  };
}
