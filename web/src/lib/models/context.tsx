import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { api } from "../api";
import { browserProvider, hadCachedDownload } from "./browser";
import { ollamaProvider } from "./ollama";
import {
  detectCapability,
  preferredDevice,
  recommend,
  type CapabilityReport,
  type Recommendation,
} from "./capability";
import { BROWSER_MODELS, OLLAMA_MODELS, OLLAMA_MODEL_ID, desktopModel, formatBytes } from "./registry";
import { flush as flushOutbox } from "./outbox";
import { isReadyStatus, parseSelection, requireReadyBeforeUse, serializeSelection } from "./rules";
import type {
  AskOut,
  ModelDescriptor,
  ModelProvider,
  ModelStatus,
  ObserveInput,
  ObserveResponse,
  ProviderId,
  Selection,
  ServerProvider,
} from "./types";

const STORAGE_KEY = "bioledger.model";

const PROVIDERS: Record<ProviderId, ModelProvider> = {
  ollama: ollamaProvider,
  browser: browserProvider,
};

export interface MergedModel extends ModelDescriptor {
  status: ModelStatus;
  present: boolean;
}

export interface MergedProvider {
  id: ProviderId;
  label: string;
  runtime: string;
  location: "server" | "client";
  status: ModelStatus;
  models: MergedModel[];
}

export interface ModelsContextValue {
  providers: MergedProvider[];
  active: Selection;
  activeModel: ModelDescriptor | null;
  status: ModelStatus;
  ready: boolean;
  busy: boolean;
  progress: number | null;
  capability: CapabilityReport | null;
  recommendation: Recommendation;
  /** Sightings saved locally in the IndexedDB outbox, awaiting the server. */
  outboxPending: number;
  select: (providerId: ProviderId, modelId: string) => void;
  ensureReady: () => Promise<void>;
  enableModel: (providerId: ProviderId, modelId: string) => Promise<void>;
  cancelDownload: () => void;
  /** Release the loaded browser model from memory; weights stay cached. */
  unload: () => void;
  /** Remove the downloaded files of a browser model best-effort. */
  deleteDownload: (modelId?: string) => Promise<void>;
  parseSighting: (input: ObserveInput) => Promise<ObserveResponse>;
  answerQuestion: (question: string) => Promise<AskOut>;
}

const ModelsContext = createContext<ModelsContextValue | null>(null);

const DEFAULT_SELECTION: Selection = { providerId: "ollama", modelId: OLLAMA_MODEL_ID };

function readSelection(): Selection {
  if (typeof localStorage === "undefined") return DEFAULT_SELECTION;
  const parsed = parseSelection(localStorage.getItem(STORAGE_KEY));
  return parsed ?? DEFAULT_SELECTION;
}

export function ModelsProvider({ children }: { children: ReactNode }) {
  const [server, setServer] = useState<ServerProvider[] | null>(null);
  const [capability, setCapability] = useState<CapabilityReport | null>(null);
  const [active, setActive] = useState<Selection>(readSelection);
  const [status, setStatus] = useState<ModelStatus>({ kind: "checking" });
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [outboxPending, setOutboxPending] = useState(0);

  useEffect(() => {
    let alive = true;
    const sync = async () => {
      try {
        const { remaining } = await flushOutbox();
        if (alive) setOutboxPending(remaining);
      } catch {
        /* keep the last count */
      }
    };
    sync();
    window.addEventListener("online", sync);
    return () => {
      alive = false;
      window.removeEventListener("online", sync);
    };
  }, []);

  useEffect(() => {
    let alive = true;
    detectCapability().then((report) => {
      if (alive) setCapability(report);
    });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const res = await api.models();
        if (alive) setServer(res.providers);
      } catch {
        /* keep the last good view */
      }
    };
    load();
    const timer = window.setInterval(load, 20000);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    let alive = true;
    const provider = PROVIDERS[active.providerId];
    const run = async () => {
      if (active.providerId === "browser" && capability && !capability.canRunBrowserModel) {
        if (alive) {
          setStatus({ kind: "unsupported", detail: "This browser cannot run the mobile model." });
        }
        return;
      }
      setStatus((prev) => (isReadyStatus(prev) ? prev : { kind: "checking" }));
      try {
        const next = await provider.status(active.modelId);
        if (alive) setStatus(next);
      } catch (error) {
        if (alive) {
          setStatus({ kind: "error", detail: error instanceof Error ? error.message : String(error) });
        }
      }
    };
    run();
    const timer = window.setInterval(run, 20000);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
    // `server` is a dependency so the Ollama view refreshes with the poll.
  }, [active, capability, server]);

  const select = useCallback((providerId: ProviderId, modelId: string) => {
    setActive({ providerId, modelId });
    setProgress(null);
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(STORAGE_KEY, serializeSelection(providerId, modelId));
    }
  }, []);

  const loadSelection = useCallback(
    async (target: Selection) => {
      const provider = PROVIDERS[target.providerId];
      setBusy(true);
      setProgress(null);
      try {
        let report = capability;
        if (!report) {
          report = await detectCapability();
          setCapability(report);
        }
        await provider.ensureReady(target.modelId, {
          device: preferredDevice(report),
          onProgress: (next) => {
            setStatus(next);
            setProgress(next.progress ?? null);
          },
        });
        setStatus(await provider.status(target.modelId));
      } catch (error) {
        setStatus({ kind: "error", detail: error instanceof Error ? error.message : String(error) });
        throw error;
      } finally {
        setBusy(false);
        setProgress(null);
      }
    },
    [capability],
  );

  const ensureReady = useCallback(() => loadSelection(active), [loadSelection, active]);

  const enableModel = useCallback(
    async (providerId: ProviderId, modelId: string) => {
      select(providerId, modelId);
      await loadSelection({ providerId, modelId });
    },
    [loadSelection, select],
  );

  const cancelDownload = useCallback(() => {
    PROVIDERS[active.providerId].cancel?.();
    if (active.providerId === "browser") {
      setBusy(false);
      setProgress(null);
      setStatus({ kind: "download_required", detail: "Download cancelled." });
    }
  }, [active.providerId]);

  const unload = useCallback(() => {
    if (active.providerId !== "browser") return;
    browserProvider.release();
    setBusy(false);
    setProgress(null);
    setStatus({
      kind: "cached",
      detail: "Unloaded. The downloaded files stay cached; load again when you want to use it.",
    });
  }, [active.providerId]);

  const deleteDownload = useCallback(async () => {
    if (active.providerId !== "browser") return;
    await browserProvider.deleteDownload?.(active.modelId);
    setBusy(false);
    setProgress(null);
    setStatus({
      kind: "download_required",
      detail: "Downloaded files were removed. Download again when you need this model.",
    });
  }, [active.providerId]);

  const parseSighting = useCallback(
    async (input: ObserveInput): Promise<ObserveResponse> => {
      requireReadyBeforeUse(active.providerId, status, "writing a new sighting");
      const provider = PROVIDERS[active.providerId];
      const result = await provider.parse(input, active.modelId, { device: preferredDevice(capability) });
      if (active.providerId === "browser") {
        flushOutbox()
          .then(({ remaining }) => setOutboxPending(remaining))
          .catch(() => undefined);
      }
      return result;
    },
    [active, capability, status],
  );

  const answerQuestion = useCallback(
    async (question: string): Promise<AskOut> => {
      requireReadyBeforeUse(active.providerId, status, "answering a journal question");
      const provider = PROVIDERS[active.providerId];
      return provider.answer(question, active.modelId, { device: preferredDevice(capability) });
    },
    [active, capability, status],
  );

  const providers = useMemo<MergedProvider[]>(() => {
    const byId = new Map((server ?? []).map((p) => [p.id, p]));
    const ollamaServer = byId.get("ollama");

    const ollamaModels: MergedModel[] = ollamaServer?.models?.some((m) => m.role === "text")
      ? ollamaServer.models
          .filter((m) => m.role === "text")
          .map((m) => {
            const display = desktopModel(m.id);
            const serverDetail = ollamaServer.status.detail;
            return {
              id: m.id,
              provider: "ollama" as const,
              runtime: "ollama" as const,
              label: display.label,
              subtitle: display.subtitle,
              text: true,
              vision: m.vision,
              license: m.license,
              present: m.present,
              // The server owns this runtime's real status. When the model is
              // installed it is ready; when it is missing we say so and never
              // substitute the optional browser model.
              status: m.present
                ? { kind: "ready" as const, detail: serverDetail }
                : {
                    kind: "not_installed" as const,
                    detail:
                      ollamaServer.status.kind === "offline"
                        ? serverDetail
                        : `Run: ollama pull ${m.id}`,
                  },
            };
          })
      : OLLAMA_MODELS.map((m) => ({ ...m, present: false, status: { kind: "checking" } as ModelStatus }));

    const browserModels: MergedModel[] = BROWSER_MODELS.map((m) => {
      const isActive = active.providerId === "browser" && active.modelId === m.id;
      let modelStatus: ModelStatus;
      if (!capability) modelStatus = { kind: "checking" };
      else if (!capability.canRunBrowserModel) {
        modelStatus = { kind: "unsupported", detail: "This browser cannot run the browser model." };
      } else if (isActive) {
        modelStatus = status;
      } else if (hadCachedDownload(m.id)) {
        // Downloaded before this page view. The AI Model Browser shows this as
        // "downloaded / load" without re-downloading anything.
        modelStatus = {
          kind: "cached",
          detail: "Downloaded to this app already. Load it when you want to use it.",
        };
      } else {
        // Not selected yet, so we do not claim it is installed, downloaded, or
        // working. This browser has the capability, but nothing is verified.
        modelStatus = {
          kind: "download_required",
          detail: `One-time download of about ${formatBytes(m.sizeBytes)}. Nothing was downloaded without your OK.`,
        };
      }
      return { ...m, present: isActive && isReadyStatus(status), status: modelStatus };
    });

    const ollamaStatus: ModelStatus = ollamaServer?.status ?? { kind: "checking" };
    return [
      {
        id: "ollama",
        label: "Ollama on this computer",
        runtime: "ollama",
        location: "server",
        status: ollamaStatus,
        models: ollamaModels,
      },
      {
        id: "browser",
        label: "This browser",
        runtime: "transformers.js",
        location: "client",
        status: active.providerId === "browser" ? status : { kind: "checking" },
        models: browserModels,
      },
    ];
  }, [server, capability, active, status]);

  const activeModel = useMemo<ModelDescriptor | null>(() => {
    for (const provider of providers) {
      if (provider.id === active.providerId) {
        const match = provider.models.find((m) => m.id === active.modelId);
        if (match) return match;
      }
    }
    return null;
  }, [providers, active]);

  const recommendation = useMemo<Recommendation>(
    () => recommend(capability, providers[0]?.status.kind === "ready"),
    [capability, providers],
  );

  const value = useMemo<ModelsContextValue>(
    () => ({
      providers,
      active,
      activeModel,
      status,
      ready: isReadyStatus(status),
      busy,
      progress,
      capability,
      recommendation,
      outboxPending,
      select,
      ensureReady,
      enableModel,
      cancelDownload,
      unload,
      deleteDownload,
      parseSighting,
      answerQuestion,
    }),
    [
      providers,
      active,
      activeModel,
      status,
      busy,
      progress,
      capability,
      recommendation,
      outboxPending,
      select,
      ensureReady,
      enableModel,
      cancelDownload,
      unload,
      deleteDownload,
      parseSighting,
      answerQuestion,
    ],
  );

  return <ModelsContext.Provider value={value}>{children}</ModelsContext.Provider>;
}

export function useModels(): ModelsContextValue {
  const ctx = useContext(ModelsContext);
  if (!ctx) throw new Error("useModels must be used inside ModelsProvider");
  return ctx;
}

export type { Selection };

