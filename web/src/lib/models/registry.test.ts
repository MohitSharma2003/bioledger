import { describe, expect, it } from "vitest";
import {
  DESKTOP_MODEL_LABEL,
  DESKTOP_MODEL_SUBTITLE,
  MOBILE_MODEL_LABEL,
  MOBILE_MODEL_SUBTITLE,
  OLLAMA_MODEL_ID,
  OLLAMA_MODELS,
  BROWSER_MODELS,
  desktopModel,
  formatBytes,
} from "./registry";

describe("model registry", () => {
  it("has exactly two roles: the default desktop model and the optional mobile model", () => {
    expect(OLLAMA_MODELS).toHaveLength(1);
    expect(BROWSER_MODELS).toHaveLength(1);
    expect(OLLAMA_MODELS[0].id).toBe("gemma3:4b");
    expect(OLLAMA_MODEL_ID).toBe("gemma3:4b");
  });

  it("uses the exact required labels and subtitles", () => {
    expect(DESKTOP_MODEL_LABEL).toBe("Gemma3:4B");
    expect(DESKTOP_MODEL_SUBTITLE).toBe("Default · This computer · Ollama");
    expect(MOBILE_MODEL_LABEL).toBe("Gemma 4 E2B (for mobile)");
    expect(MOBILE_MODEL_SUBTITLE).toBe("Optional · Browser-local inference");
  });

  it("does not present the mobile model as an Ollama model or a fallback", () => {
    expect(OLLAMA_MODELS.map((m) => m.id)).not.toContain(BROWSER_MODELS[0].id);
    expect(BROWSER_MODELS[0].provider).toBe("browser");
  });

  it("labels a server-reported Ollama model by its role", () => {
    expect(desktopModel("gemma3:4b")).toEqual({
      label: DESKTOP_MODEL_LABEL,
      subtitle: DESKTOP_MODEL_SUBTITLE,
    });
  });

  it("formats download sizes for consent", () => {
    expect(formatBytes(3_381_966_758)).toBe("3.15 GB");
    expect(formatBytes(0)).toBe("unknown size");
  });
});
