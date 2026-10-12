import { useMemo, useState } from "react";
import {
  AlertTriangle,
  Cpu,
  Download,
  ExternalLink,
  HardDrive,
  Loader2,
  Plus,
  Search,
  ShieldCheck,
  Trash2,
  Unplug,
  WifiOff,
  X,
  Zap,
} from "lucide-react";
import { cn } from "../lib/utils";
import { useModels } from "../lib/models/context";
import {
  MODEL_CATALOG,
  MODEL_TASK_FILTERS,
  MODEL_TASK_LABELS,
  RUNTIME_DEVICE_LABELS,
  type CatalogModel,
  type ModelTask,
} from "../lib/models/catalog";
import { formatBytes } from "../lib/models/registry";
import type { StatusKind } from "../lib/models/types";

const STATUS_LABEL: Record<StatusKind, string> = {
  ready: "ready",
  offline_ready: "ready · works offline",
  checking: "checking",
  not_installed: "not installed",
  offline: "offline",
  download_required: "not downloaded",
  cached: "downloaded · not loaded",
  downloading: "downloading",
  initializing: "starting",
  unsupported: "unsupported here",
  out_of_memory: "out of memory",
  error: "failed",
  unverified: "not verified",
  unknown: "not checked",
};

function statusTone(kind: StatusKind): string {
  switch (kind) {
    case "ready":
    case "offline_ready":
      return "bg-moss";
    case "not_installed":
    case "offline":
    case "unsupported":
    case "out_of_memory":
    case "error":
      return "bg-terracotta";
    default:
      return "bg-ochre";
  }
}

const DOWNLOADING: StatusKind[] = ["downloading", "initializing"];
const FAILED: StatusKind[] = ["error", "unsupported", "out_of_memory"];
const HAS_FILES: StatusKind[] = ["cached", "ready", "offline_ready"];

export function ModelBrowser() {
  const {
    providers,
    active,
    capability,
    busy,
    progress,
    enableModel,
    select,
    cancelDownload,
    unload,
    deleteDownload,
  } = useModels();

  const [query, setQuery] = useState("");
  const [task, setTask] = useState<ModelTask | "all">("all");
  const [confirm, setConfirm] = useState<CatalogModel | null>(null);
  const [deleting, setDeleting] = useState<CatalogModel | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const browserModels = useMemo(() => {
    const provider = providers.find((p) => p.id === "browser");
    return new Map((provider?.models ?? []).map((m) => [m.id, m]));
  }, [providers]);

  const freeBytes =
    capability?.storageQuotaBytes != null && capability.storageUsageBytes != null
      ? capability.storageQuotaBytes - capability.storageUsageBytes
      : null;

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return MODEL_CATALOG.filter((m) => {
      if (task !== "all" && !m.tasks.includes(task)) return false;
      if (!q) return true;
      return (
        m.name.toLowerCase().includes(q) ||
        m.publisher.toLowerCase().includes(q) ||
        m.id.toLowerCase().includes(q) ||
        m.tasks.some((t) => MODEL_TASK_LABELS[t].toLowerCase().includes(q))
      );
    });
  }, [query, task]);

  const visionAvailable = MODEL_CATALOG.some((m) => m.vision);

  async function runDownload(model: CatalogModel) {
    setBusyId(model.id);
    try {
      await enableModel("browser", model.id);
    } catch {
      /* status already reflects the failure */
    } finally {
      setBusyId(null);
    }
  }

  async function runDelete(model: CatalogModel) {
    setBusyId(model.id);
    try {
      await deleteDownload(model.id);
    } catch {
      /* status already reflects the failure */
    } finally {
      setBusyId(null);
      setDeleting(null);
    }
  }

  return (
    <div className="space-y-8">
      <CapabilityStrip />

      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="relative max-w-md flex-1">
          <Search
            size={16}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
          />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by model, publisher, or task"
            aria-label="Search models"
            className="h-11 w-full rounded-sm border border-rule-strong/70 bg-paper-raised pl-9 pr-3 text-[0.9rem] text-forest placeholder:text-muted focus:border-moss focus:outline-none"
          />
        </div>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter by task">
          <Chip active={task === "all"} onClick={() => setTask("all")}>
            All
          </Chip>
          {MODEL_TASK_FILTERS.map((f) => (
            <Chip key={f.slug} active={task === f.task} onClick={() => setTask(f.task)}>
              {MODEL_TASK_LABELS[f.task]}
            </Chip>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        {visible.length === 0 ? (
          <div className="rounded-sm border border-dashed border-rule-strong/70 bg-paper-raised/40 px-6 py-12 text-center text-[0.95rem] italic text-muted">
            No models match that search or filter.
          </div>
        ) : (
          visible.map((model) => {
            const merged = browserModels.get(model.id);
            const kind: StatusKind = merged?.status.kind ?? "download_required";
            const detail = merged?.status.detail;
            const isActive = active.providerId === "browser" && active.modelId === model.id;
            const isBusy = busy || busyId === model.id;
            const progressValue =
              isActive && kind === "downloading" ? (progress ?? 0) : null;
            const storageBlocked =
              freeBytes !== null && freeBytes < model.sizeBytes * 1.1;
            const hasFiles = HAS_FILES.includes(kind);
            const canDownloadHere =
              kind === "download_required" && !storageBlocked && Boolean(capability?.webgpu);

            return (
              <article
                key={model.id}
                className={cn(
                  "rounded-sm border bg-paper-raised p-5 shadow-specimen sm:p-6",
                  isActive ? "border-moss" : "border-rule",
                )}
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => select("browser", model.id)}
                        aria-pressed={isActive}
                        className="flex min-h-[44px] items-center gap-2.5 text-left"
                      >
                        <span
                          className={cn(
                            "grid h-4 w-4 shrink-0 place-items-center rounded-full border",
                            isActive
                              ? "border-moss bg-moss text-paper-raised"
                              : "border-rule-strong",
                          )}
                          aria-hidden
                        >
                          {isActive ? <Plus size={11} className="rotate-45" /> : null}
                        </span>
                        <h2 className="text-[1.15rem] font-serif text-forest">{model.name}</h2>
                      </button>
                      {model.verified ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-sage px-2.5 py-0.5 font-mono text-[0.62rem] uppercase tracking-[0.08em] text-moss">
                          <ShieldCheck size={11} /> verified
                        </span>
                      ) : null}
                      {model.recommended ? (
                        <span className="inline-flex items-center rounded-full bg-ochre/15 px-2.5 py-0.5 font-mono text-[0.62rem] uppercase tracking-[0.08em] text-ochre">
                          recommended
                        </span>
                      ) : null}
                    </div>

                    <p className="mt-1 font-mono text-[0.66rem] uppercase tracking-[0.08em] text-muted">
                      {model.publisher}
                    </p>

                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {model.tasks.map((t) => (
                        <span
                          key={t}
                          className="rounded-sm border border-rule-strong/60 px-2 py-0.5 text-[0.7rem] text-muted"
                        >
                          {MODEL_TASK_LABELS[t]}
                        </span>
                      ))}
                    </div>

                    <dl className="mt-3 grid max-w-xl grid-cols-2 gap-x-4 gap-y-2 font-mono text-[0.7rem] text-muted sm:grid-cols-4">
                      <Meta label="Download">
                        {formatBytes(model.sizeBytes)}
                      </Meta>
                      <Meta label="Device">
                        {model.devices.map((d) => RUNTIME_DEVICE_LABELS[d]).join(" + ")}
                      </Meta>
                      <Meta label="License">{model.license}</Meta>
                      <Meta label="Runtime">{model.runtime}</Meta>
                    </dl>

                    <p className="mt-3 max-w-2xl text-[0.88rem] leading-relaxed text-forest/90">
                      {model.note}
                    </p>
                    <p className="mt-1.5 max-w-2xl font-mono text-[0.66rem] uppercase tracking-[0.05em] text-muted">
                      {model.hardware}
                    </p>
                    {model.licenseNote ? (
                      <p className="mt-1.5 max-w-2xl text-[0.78rem] leading-relaxed text-muted">
                        {model.licenseNote}
                      </p>
                    ) : null}
                    {model.verifiedDetail ? (
                      <p className="mt-1.5 inline-flex items-center gap-1 text-[0.78rem] text-moss">
                        <ShieldCheck size={13} /> {model.verifiedDetail}
                      </p>
                    ) : null}
                    <a
                      href={model.hfUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-2 inline-flex h-11 items-center gap-1 text-[0.78rem] text-moss underline decoration-dotted underline-offset-4 hover:text-forest"
                    >
                      Hugging Face repo <ExternalLink size={12} />
                    </a>
                  </div>

                  <div className="w-full min-w-0 shrink-0 space-y-3 lg:w-72">
                    <div className="flex items-center gap-2 rounded-sm bg-sage/45 px-3 py-2">
                      <span className={cn("h-2 w-2 shrink-0 rounded-full", statusTone(kind))} aria-hidden />
                      <p className="font-mono text-[0.64rem] uppercase tracking-[0.08em] text-forest">
                        {STATUS_LABEL[kind]}
                      </p>
                    </div>

                    {kind === "downloading" || kind === "initializing" ? (
                      <div>
                        <div className="flex items-center gap-2">
                          <Loader2 size={14} className="shrink-0 animate-spin text-ochre" />
                          <div className="h-2 w-full overflow-hidden rounded-full bg-sage">
                            <div
                              className="h-full bg-moss transition-[width]"
                              style={{ width: `${Math.round((progressValue ?? 0.02) * 100)}%` }}
                            />
                          </div>
                        </div>
                        <p className="mt-1 font-mono text-[0.6rem] uppercase tracking-[0.08em] text-muted">
                          {kind === "initializing"
                            ? "preparing on the GPU…"
                            : `${Math.round((progressValue ?? 0) * 100)}% of ${formatBytes(model.sizeBytes)}`}
                        </p>
                      </div>
                    ) : null}

                    <div className="flex flex-wrap gap-2">
                      {kind === "download_required" ? (
                        <button
                          type="button"
                          onClick={() => setConfirm(model)}
                          disabled={isBusy || storageBlocked || !capability?.webgpu}
                          className="flex h-11 items-center gap-1.5 rounded-sm bg-forest px-3.5 text-[0.82rem] text-paper-raised hover:bg-forest-2 disabled:opacity-50"
                        >
                          <Download size={14} /> Download {formatBytes(model.sizeBytes)}
                        </button>
                      ) : null}

                      {kind === "cached" ? (
                        <button
                          type="button"
                          onClick={() => runDownload(model)}
                          disabled={isBusy}
                          className="flex h-11 items-center gap-1.5 rounded-sm bg-forest px-3.5 text-[0.82rem] text-paper-raised hover:bg-forest-2 disabled:opacity-50"
                        >
                          <Zap size={14} /> Load
                        </button>
                      ) : null}

                      {DOWNLOADING.includes(kind) && isActive ? (
                        <button
                          type="button"
                          onClick={cancelDownload}
                          className="flex h-11 items-center gap-1.5 rounded-sm border border-rule-strong px-3.5 text-[0.82rem] text-forest hover:bg-sage"
                        >
                          <X size={14} /> Cancel download
                        </button>
                      ) : null}

                      {isActive && (kind === "ready" || kind === "offline_ready") ? (
                        <button
                          type="button"
                          onClick={unload}
                          className="flex h-11 items-center gap-1.5 rounded-sm border border-rule-strong px-3.5 text-[0.82rem] text-forest hover:bg-sage"
                        >
                          <Unplug size={14} /> Unload
                        </button>
                      ) : null}

                      {FAILED.includes(kind) && capability?.webgpu ? (
                        <button
                          type="button"
                          onClick={() => runDownload(model)}
                          disabled={isBusy}
                          className="flex h-11 items-center gap-1.5 rounded-sm bg-ochre px-3.5 text-[0.82rem] text-paper-raised hover:bg-terracotta disabled:opacity-50"
                        >
                          <Loader2 size={14} /> Retry
                        </button>
                      ) : null}

                      {hasFiles ? (
                        <button
                          type="button"
                          onClick={() => setDeleting(model)}
                          disabled={isBusy}
                          className="flex h-11 items-center gap-1.5 rounded-sm border border-rule-strong px-3.5 text-[0.78rem] text-muted hover:border-terracotta hover:text-alert disabled:opacity-50"
                        >
                          <Trash2 size={13} /> Delete files
                        </button>
                      ) : null}
                    </div>

                    {storageBlocked && kind === "download_required" ? (
                      <p className="flex items-start gap-1.5 text-[0.78rem] leading-relaxed text-alert">
                        <AlertTriangle size={13} className="mt-0.5 shrink-0" />
                        Not enough free browser storage for this download. Free up space or use
                        another browser.
                      </p>
                    ) : null}
                    {!capability?.webgpu ? (
                      <p className="flex items-start gap-1.5 text-[0.78rem] leading-relaxed text-alert">
                        <WifiOff size={13} className="mt-0.5 shrink-0" />
                        This browser cannot run WebGPU models, so this one cannot be downloaded or
                        loaded here.
                      </p>
                    ) : null}

                    {detail ? (
                      <p className="text-[0.78rem] leading-relaxed text-muted">{detail}</p>
                    ) : null}
                  </div>
                </div>
              </article>
            );
          })
        )}
      </div>

      {!visionAvailable || task === "vision" ? <VisionNote /> : null}

      <p className="border-t border-rule pt-4 text-[0.78rem] leading-relaxed text-muted">
        Privacy: every download here comes from Hugging Face only after you press Download, and all
        inference happens in this browser on your device. Prompts, journal context, and observations
        are never sent to an external AI service. Cached weights are browser storage: they can be
        cleared by the browser or the operating system, so treat the models as cached, not permanent.
      </p>

      {confirm ? (
        <ConfirmDialog
          title={`Download ${confirm.name}?`}
          onCancel={() => setConfirm(null)}
          onConfirm={() => {
            const target = confirm;
            setConfirm(null);
            runDownload(target);
          }}
        >
          <p className="text-[0.92rem] leading-relaxed text-forest">
            This downloads about{" "}
            <strong className="font-medium">{formatBytes(confirm.sizeBytes)}</strong> from Hugging
            Face into this app's cache and then runs entirely on this device. It may take a while on
            a slow connection.
          </p>
          <p className="mt-2 text-[0.82rem] leading-relaxed text-muted">
            You can cancel at any time, and the download can be resumed where supported. Nothing is
            downloaded before you confirm.
          </p>
        </ConfirmDialog>
      ) : null}

      {deleting ? (
        <ConfirmDialog
          title={`Delete ${deleting.name} files?`}
          onCancel={() => setDeleting(null)}
          onConfirm={() => runDelete(deleting)}
          danger
        >
          <p className="text-[0.92rem] leading-relaxed text-forest">
            This removes the downloaded model files from this app's browser storage (about{" "}
            {formatBytes(deleting.sizeBytes)}). The next use needs a fresh download.
          </p>
          <p className="mt-2 text-[0.82rem] leading-relaxed text-muted">
            Some browsers can keep fragments of the cached files. If storage is not fully freed,
            reload the page and try the browser's own cache-clearing step too.
          </p>
        </ConfirmDialog>
      ) : null}
    </div>
  );
}

function CapabilityStrip() {
  const { capability } = useModels();
  const items = [
    {
      icon: Cpu,
      label: "Device",
      value: capability?.webgpu ? "WebGPU available" : "WebGPU unavailable",
    },
    {
      icon: HardDrive,
      label: "Browser storage",
      value:
        capability?.storageQuotaBytes != null
          ? `${formatBytes(capability.storageQuotaBytes)} free-ish quota`
          : "unknown",
    },
    {
      icon: ShieldCheck,
      label: "Inference",
      value: "Runs in this browser",
    },
  ];
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {items.map((item) => (
        <div
          key={item.label}
          className="flex items-start gap-3 rounded-sm border border-rule bg-paper-raised/70 px-4 py-3.5"
        >
          <item.icon size={16} className="mt-0.5 shrink-0 text-moss" />
          <div>
            <p className="font-mono text-[0.62rem] uppercase tracking-[0.09em] text-muted">
              {item.label}
            </p>
            <p className="mt-0.5 text-[0.88rem] text-forest">{item.value}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

function Meta({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="uppercase">{label}</dt>
      <dd className="mt-0.5 text-[0.78rem] text-forest">{children}</dd>
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "inline-flex min-h-[44px] items-center rounded-full border px-3.5 text-[0.78rem] transition-colors",
        active
          ? "border-moss bg-moss text-paper-raised"
          : "border-rule-strong/60 text-muted hover:border-moss hover:text-forest",
      )}
    >
      {children}
    </button>
  );
}

function VisionNote() {
  return (
    <div className="flex items-start gap-3 rounded-sm border border-dashed border-rule-strong/70 bg-paper-raised/40 px-5 py-6">
      <AlertTriangle size={18} className="mt-0.5 shrink-0 text-ochre" />
      <div>
        <p className="text-[0.95rem] text-forest">
          Image understanding is not available in the browser yet.
        </p>
        <p className="mt-1 max-w-2xl text-[0.85rem] leading-relaxed text-muted">
          No vision model has been verified to download and load with this app's browser runtime, so
          none is listed here. Photos are still saved with your notes; photo interpretation stays
          limited to a machine that runs Ollama. A vision model will appear here only after it has
          been verified end-to-end.
        </p>
      </div>
    </div>
  );
}

function ConfirmDialog({
  title,
  danger,
  onCancel,
  onConfirm,
  children,
}: {
  title: string;
  danger?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-50 flex items-center justify-center bg-forest/40 p-4 backdrop-blur-sm"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-md rounded-sm border border-rule bg-paper-raised p-6 shadow-specimen"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="font-serif text-[1.25rem] text-forest">{title}</h2>
        <div className="mt-3">{children}</div>
        <div className="mt-6 flex flex-wrap justify-end gap-2.5">
          <button
            type="button"
            onClick={onCancel}
            className="flex min-h-[44px] items-center rounded-sm border border-rule-strong px-4 text-[0.85rem] text-forest hover:bg-sage"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={cn(
              "flex min-h-[44px] items-center gap-1.5 rounded-sm px-5 text-[0.85rem] text-paper-raised",
              danger ? "bg-terracotta hover:bg-alert" : "bg-forest hover:bg-forest-2",
            )}
          >
            {danger ? <Trash2 size={14} /> : <Download size={14} />}
            {danger ? "Delete files" : "Start download"}
          </button>
        </div>
      </div>
    </div>
  );
}