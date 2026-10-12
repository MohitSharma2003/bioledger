import { afterEach, describe, expect, it, vi } from "vitest";
import { detectCapability, recommend, type CapabilityReport } from "./capability";

const REPORT: CapabilityReport = {
  webgpu: true,
  wasm: true,
  crossOriginIsolated: false,
  deviceMemoryGB: null,
  storageQuotaBytes: null,
  storageUsageBytes: null,
  persistentStorage: false,
  canRunBrowserModel: true,
  reasons: [],
};

afterEach(() => vi.unstubAllGlobals());

describe("detectCapability", () => {
  it("reports the mobile model as unsupported without WebGPU", async () => {
    vi.stubGlobal("navigator", {});
    const report = await detectCapability();
    expect(report.webgpu).toBe(false);
    expect(report.canRunBrowserModel).toBe(false);
  });

  it("allows the mobile model when a WebGPU adapter is available", async () => {
    vi.stubGlobal("navigator", { gpu: { requestAdapter: async () => ({ name: "fake" }) } });
    const report = await detectCapability();
    expect(report.webgpu).toBe(true);
    expect(report.canRunBrowserModel).toBe(true);
  });

  it("treats a missing adapter as unsupported", async () => {
    vi.stubGlobal("navigator", { gpu: { requestAdapter: async () => null } });
    const report = await detectCapability();
    expect(report.canRunBrowserModel).toBe(false);
  });

  it("treats an adapter error as unsupported, not a crash", async () => {
    vi.stubGlobal("navigator", {
      gpu: {
        requestAdapter: async () => {
          throw new Error("adapter blew up");
        },
      },
    });
    const report = await detectCapability();
    expect(report.canRunBrowserModel).toBe(false);
    expect(report.webgpu).toBe(false);
  });
});

describe("recommend", () => {
  it("keeps the desktop model when the server is ready", () => {
    expect(recommend(REPORT, true).providerId).toBe("ollama");
  });

  it("suggests the browser model only when the server is down", () => {
    expect(recommend(REPORT, false).providerId).toBe("browser");
  });

  it("reports unsupported when neither runtime is available", () => {
    expect(recommend(null, false).providerId).toBe("unsupported");
  });
});
