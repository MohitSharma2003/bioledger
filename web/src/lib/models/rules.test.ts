import { describe, expect, it } from "vitest";
import {
  isReadyStatus,
  parseSelection,
  requireReadyBeforeUse,
  serializeSelection,
} from "./rules";

describe("model selection persistence", () => {
  it("round-trips a browser selection with an id containing a colon path", () => {
    const modelId = "onnx-community/gemma-4-E2B-it-ONNX";
    const raw = serializeSelection("browser", modelId);
    expect(raw).toBe(`browser:${modelId}`);
    expect(parseSelection(raw)).toEqual({ providerId: "browser", modelId });
  });

  it("round-trips the Ollama selection", () => {
    const raw = serializeSelection("ollama", "gemma3:4b");
    expect(parseSelection(raw)).toEqual({ providerId: "ollama", modelId: "gemma3:4b" });
  });

  it("rejects unknown providers", () => {
    expect(parseSelection("unknown:abc")).toBeNull();
  });

  it("rejects a shape without a model id", () => {
    expect(parseSelection("browser:")).toBeNull();
    expect(parseSelection(null)).toBeNull();
    expect(parseSelection("")).toBeNull();
  });
});

describe("no silent server inference fallback", () => {
  it("blocks the browser provider until its model is ready", () => {
    expect(() =>
      requireReadyBeforeUse("browser", { kind: "download_required" }, "writing a new sighting"),
    ).toThrow(/not ready/i);
    expect(() =>
      requireReadyBeforeUse("browser", { kind: "error" }, "answering a question"),
    ).toThrow(/not ready/i);
  });

  it("allows the browser provider when the model is ready or offline_ready", () => {
    expect(() =>
      requireReadyBeforeUse("browser", { kind: "offline_ready" }, "writing a new sighting"),
    ).not.toThrow();
    expect(() =>
      requireReadyBeforeUse("browser", { kind: "ready" }, "writing a new sighting"),
    ).not.toThrow();
  });

  it("never blocks the Ollama provider through the browser guard", () => {
    expect(() =>
      requireReadyBeforeUse("ollama", { kind: "error" }, "writing a new sighting"),
    ).not.toThrow();
  });

  it("knows which statuses count as ready", () => {
    expect(isReadyStatus({ kind: "ready" })).toBe(true);
    expect(isReadyStatus({ kind: "offline_ready" })).toBe(true);
    expect(isReadyStatus({ kind: "downloading" })).toBe(false);
    expect(isReadyStatus({ kind: "cached" })).toBe(false);
  });
});