import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Download, Loader2, Play, X } from "lucide-react";
import { cn } from "../lib/utils";
import { useModels, type MergedModel } from "../lib/models/context";
import { DESKTOP_MODEL_LABEL, OLLAMA_MODEL_ID, formatBytes } from "../lib/models/registry";
import type { StatusKind } from "../lib/models/types";

const STATUS_LABEL: Record<StatusKind, string> = {
  ready: "ready",
  offline_ready: "ready offline",
  checking: "checking",
  not_installed: "not installed",
  offline: "offline",
  download_required: "needs download",
  cached: "downloaded · tap to load",
  downloading: "downloading",
  initializing: "starting",
  unsupported: "unsupported",
  out_of_memory: "out of memory",
  error: "error",
  unverified: "not verified yet",
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
    case "download_required":
    case "cached":
    case "downloading":
    case "initializing":
    case "checking":
      return "bg-ochre";
    default:
      return "bg-muted";
  }
}

const FAILED: StatusKind[] = ["unsupported", "out_of_memory", "error"];

function RuntimeRow({
  model,
  isDesktop,
  selected,
  onSelect,
  onDownload,
  onCancel,
  onFallback,
  busy,
  progress,
  storageBlocked,
}: {
  model: MergedModel;
  isDesktop: boolean;
  selected: boolean;
  onSelect: () => void;
  onDownload: () => void;
  onCancel: () => void;
  onFallback: () => void;
  busy: boolean;
  progress: number | null;
  storageBlocked: boolean;
}) {
  const needsDownload = model.status.kind === "download_required";
  const needsLoad = model.status.kind === "cached";
  // Download (or load) is only offered once the user selects this option, so
  // simply showing the card never starts a download.
  const showDownload = (needsDownload || needsLoad) && selected;
  const isDownloading = model.status.kind === "downloading" && selected;
  const blocked = showDownload && needsDownload && storageBlocked;
  // If the optional model fails, offer the way back to the desktop model.
  const canFallback = !isDesktop && selected && FAILED.includes(model.status.kind);

  return (
    <li className="rounded-sm">
      <div
        className={cn(
          "flex min-h-[44px] items-center gap-2 rounded-sm px-2",
          selected ? "bg-sage" : "hover:bg-sage/50",
        )}
      >
        <button
          type="button"
          onClick={onSelect}
          aria-pressed={selected}
          className="flex min-h-[44px] flex-1 items-center gap-2.5 py-2 text-left"
        >
          <span
            className={cn(
              "grid h-4 w-4 shrink-0 place-items-center rounded-full border",
              selected ? "border-moss bg-moss text-paper-raised" : "border-rule-strong",
            )}
            aria-hidden
          >
            {selected ? <Check size={11} /> : null}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[0.9rem] text-forest">{model.label}</span>
            {model.subtitle ? (
              <span className="mt-0.5 block truncate font-mono text-[0.62rem] uppercase tracking-[0.08em] text-muted">
                {model.subtitle}
              </span>
            ) : null}
            <span className="mt-0.5 flex items-center gap-1.5 font-mono text-[0.62rem] uppercase tracking-[0.08em] text-muted">
              <span className={cn("h-1.5 w-1.5 rounded-full", statusTone(model.status.kind))} />
              {STATUS_LABEL[model.status.kind]}
              {model.vision ? " · reads photos" : ""}
            </span>
          </span>
        </button>
        {showDownload ? (
          <button
            type="button"
            onClick={onDownload}
            disabled={busy || blocked}
            className="flex min-h-[36px] shrink-0 items-center gap-1.5 rounded-sm border border-rule-strong px-2.5 text-[0.74rem] text-forest hover:bg-sage disabled:opacity-50"
          >
            {needsLoad ? <Play size={13} /> : <Download size={13} />}
            {needsLoad ? "Load" : `Download ${formatBytes(model.sizeBytes)}`}
          </button>
        ) : null}
        {isDownloading ? (
          <button
            type="button"
            onClick={onCancel}
            className="flex min-h-[36px] shrink-0 items-center gap-1.5 rounded-sm border border-rule-strong px-2.5 text-[0.74rem] text-forest hover:bg-sage"
          >
            <X size={13} />
            Cancel
          </button>
        ) : null}
      </div>

      {blocked ? (
        <p className="px-2 pb-1.5 pl-8 text-[0.72rem] leading-relaxed text-alert">
          Not enough free storage for the {formatBytes(model.sizeBytes)} download.
        </p>
      ) : null}

      {model.status.detail ? (
        <p className="px-2 pb-1.5 pl-8 text-[0.72rem] leading-relaxed text-muted">
          {model.status.detail}
        </p>
      ) : null}

      {isDownloading ? (
        <div className="px-2 pb-2 pl-8">
          <div className="flex items-center gap-2">
            <Loader2 size={13} className="shrink-0 animate-spin text-ochre" />
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-sage">
              <div
                className="h-full bg-moss transition-[width]"
                style={{ width: `${Math.round((progress ?? 0) * 100)}%` }}
              />
            </div>
          </div>
          <p className="mt-1 font-mono text-[0.6rem] uppercase tracking-[0.08em] text-muted">
            {Math.round((progress ?? 0) * 100)}% · {formatBytes(model.sizeBytes)}
          </p>
        </div>
      ) : null}

      {canFallback ? (
        <div className="px-2 pb-2 pl-8">
          <button
            type="button"
            onClick={onFallback}
            className="min-h-[36px] rounded-sm border border-rule-strong px-2.5 text-[0.74rem] text-forest hover:bg-sage"
          >
            Use {DESKTOP_MODEL_LABEL}
          </button>
        </div>
      ) : null}
    </li>
  );
}

export function ModelSelector({ className }: { className?: string }) {
  const {
    providers,
    active,
    activeModel,
    status,
    select,
    enableModel,
    cancelDownload,
    busy,
    progress,
    outboxPending,
    capability,
  } = useModels();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const activeLabel = activeModel?.label ?? DESKTOP_MODEL_LABEL;

  const freeBytes =
    capability?.storageQuotaBytes != null && capability.storageUsageBytes != null
      ? capability.storageQuotaBytes - capability.storageUsageBytes
      : null;
  const storageBlocked = (sizeBytes?: number): boolean =>
    freeBytes !== null && sizeBytes !== undefined && freeBytes < sizeBytes * 1.1;

  useEffect(() => {
    if (!open) return;
    function onPointer(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="true"
        aria-expanded={open}
        aria-label={`Model ${activeLabel}, ${STATUS_LABEL[status.kind]}. Choose a model.`}
        className="flex h-11 items-center gap-2 rounded-full border border-rule-strong/70 bg-paper-raised px-3 text-forest hover:bg-sage/60"
      >
        <span className={cn("h-2 w-2 shrink-0 rounded-full", statusTone(status.kind))} aria-hidden />
        <span className="max-w-[7rem] truncate text-[0.82rem] font-medium sm:max-w-[10rem]">
          {activeLabel}
        </span>
        <ChevronDown size={15} className={cn("shrink-0 transition-transform", open ? "rotate-180" : "")} />
      </button>

      {open ? (
        <div
          role="dialog"
          aria-label="Choose a model"
          className="absolute right-0 z-40 mt-2 w-[min(22rem,calc(100vw-1.5rem))] rounded-sm border border-rule bg-paper-raised p-2 shadow-specimen"
        >
          <div className="px-2 pb-1.5 pt-1">
            <p className="text-[0.92rem] text-forest">Choose a model</p>
            <p className="mt-0.5 font-mono text-[0.6rem] uppercase tracking-[0.09em] text-muted">
              {DESKTOP_MODEL_LABEL} is the default for this computer
            </p>
          </div>

          {providers.map((provider) => (
            <div key={provider.id} className="py-0.5">
              {provider.models.map((model) => (
                <RuntimeRow
                  key={`${provider.id}:${model.id}`}
                  model={model}
                  isDesktop={provider.id === "ollama"}
                  selected={active.providerId === provider.id && active.modelId === model.id}
                  onSelect={() => select(provider.id, model.id)}
                  onDownload={() => {
                    enableModel(provider.id, model.id).catch(() => {
                      /* status already reflects the failure */
                    });
                  }}
                  onCancel={cancelDownload}
                  onFallback={() => select("ollama", OLLAMA_MODEL_ID)}
                  busy={busy}
                  progress={progress}
                  storageBlocked={storageBlocked(model.sizeBytes)}
                />
              ))}
            </div>
          ))}

          <p className="border-t border-rule px-2 pt-2 pb-1 text-[0.72rem] leading-relaxed text-muted">
            Everything runs on your machine. The mobile model is optional: it
            downloads once, then is cached for offline use. No data leaves your device.
          </p>
          {outboxPending > 0 ? (
            <p className="px-2 pb-1 font-mono text-[0.62rem] uppercase tracking-[0.08em] text-ochre">
              {outboxPending} sighting{outboxPending === 1 ? "" : "s"} saved offline, waiting to sync
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
