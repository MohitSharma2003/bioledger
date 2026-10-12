import { describe, expect, it } from "vitest";
import { MODEL_CATALOG } from "./catalog";
import { BROWSER_MODELS, GEMMA4_E2B_ONNX_BYTES, GEMMA4_E2B_ONNX_ID } from "./registry";

describe("AI model catalog integrity", () => {
  it("lists only verified models with real provenance", () => {
    for (const model of MODEL_CATALOG) {
      // Hugging Face org/name repo id, so the runtime can resolve it.
      expect(model.id).toMatch(/^[\w.-]+\/[\w.-]+$/);
      expect(model.runtime).toBe("transformers.js");
      expect(model.sizeBytes).toBeGreaterThan(0);
      expect(model.publisher.length).toBeGreaterThan(0);
      expect(model.license.length).toBeGreaterThan(0);
      expect(model.devices.length).toBeGreaterThan(0);
      expect(model.hardware.length).toBeGreaterThan(0);
      expect(model.className.length).toBeGreaterThan(0);
      expect(model.dtype.length).toBeGreaterThan(0);
      // A listed model must have been proven to download AND load.
      expect(model.verified).toBe(true);
      expect(model.verifiedDetail?.length).toBeGreaterThan(0);
    }
  });

  it("never routes image understanding to a text-only model", () => {
    for (const model of MODEL_CATALOG) {
      if (model.vision) expect(model.tasks).toContain("vision");
      if (!model.text) expect(model.tasks).not.toContain("text");
      if (!model.vision) expect(model.tasks).not.toContain("vision");
    }
    // There is no verified vision model yet, so the app must not claim photo AI.
    expect(MODEL_CATALOG.some((m) => m.vision)).toBe(false);
  });

  it("covers the tasks the app actually drives", () => {
    // Text generation, structured observation extraction, and question
    // answering are all exercised by the app. At least one verified model must
    // support them; no entry may advertise a task it cannot perform.
    for (const model of MODEL_CATALOG) {
      for (const task of model.tasks) {
        if (task === "text") expect(model.text).toBe(true);
        if (task === "vision") expect(model.vision).toBe(true);
      }
    }
    expect(MODEL_CATALOG.some((m) => m.tasks.includes("text"))).toBe(true);
  });

  it("keeps every catalog entry in the browser model registry", () => {
    expect(BROWSER_MODELS.map((m) => m.id)).toEqual(MODEL_CATALOG.map((m) => m.id));
    expect(BROWSER_MODELS[0].id).toBe(GEMMA4_E2B_ONNX_ID);
    expect(BROWSER_MODELS[0].sizeBytes).toBe(GEMMA4_E2B_ONNX_BYTES);
    expect(BROWSER_MODELS[0].vision).toBe(false);
  });
});