import type { ModelStatus, ProviderId, Selection } from "./types";

/**
 * Pure helpers shared by the model context and the AI Model Browser. They are
 * kept free of React and DOM so they are deterministic to test and to reuse
 * from either side.
 */

export function isReadyStatus(status: ModelStatus): boolean {
  return status.kind === "ready" || status.kind === "offline_ready";
}

export function serializeSelection(providerId: ProviderId, modelId: string): string {
  return `${providerId}:${modelId}`;
}

export function parseSelection(raw: string | null): Selection | null {
  if (!raw) return null;
  const [providerId, ...rest] = raw.split(":");
  const modelId = rest.join(":");
  if ((providerId === "ollama" || providerId === "browser") && modelId.trim()) {
    return { providerId, modelId };
  }
  return null;
}

/**
 * The browser provider must never silently fall back to the server. When the
 * selected model is the browser one and it is not loaded, this throws an
 * actionable error instead of letting the caller use the server path.
 *
 * The Ollama provider is a server runtime: the server reports its own
 * readiness and errors, so no guard is needed here.
 */
export function requireReadyBeforeUse(
  providerId: ProviderId,
  status: ModelStatus,
  feature: string,
): void {
  if (providerId === "browser" && !isReadyStatus(status)) {
    throw new Error(
      `The browser model is not ready yet, so ${feature} cannot start. ` +
        "Open AI Model Browser and download or load the model first.",
    );
  }
}