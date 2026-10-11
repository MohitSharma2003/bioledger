import { useState } from "react";
import { Link, NavLink } from "react-router-dom";
import { Leaf, Menu, X } from "lucide-react";
import { cn } from "../lib/utils";
import { NAV_ROUTES } from "../lib/routes";
import type { Health } from "../lib/types";

function StatusPill({
  health,
  modelReady,
}: {
  health: Health | null;
  modelReady: boolean;
}) {
  const state = modelReady ? "ready" : health?.ollama ? "loading" : "offline";
  const label =
    state === "ready"
      ? health?.model ?? "model ready"
      : state === "loading"
        ? "model missing"
        : "model offline";
  const dot =
    state === "ready"
      ? "bg-moss"
      : state === "loading"
        ? "bg-ochre"
        : "bg-terracotta";
  return (
    <span
      className="hidden items-center gap-2 rounded-full border border-rule-strong/70 bg-paper-raised px-3 py-1.5 font-mono text-[0.66rem] uppercase tracking-[0.08em] text-muted sm:inline-flex"
      title={
        health
          ? `Ollama ${health.ollama ? "up" : "down"} · ${health.model}`
          : "Checking model..."
      }
    >
      <span className={cn("h-2 w-2 rounded-full", dot)} />
      {label}
    </span>
  );
}

export function Navbar({
  health,
  modelReady,
}: {
  health: Health | null;
  modelReady: boolean;
}) {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-30 border-b border-rule bg-paper/85 shadow-nav backdrop-blur-md">
      <div className="shell flex h-16 items-center justify-between gap-4">
        <Link
          to="/"
          onClick={() => setOpen(false)}
          className="flex items-center gap-2.5 text-forest"
          aria-label="Bioledger, go to new sighting"
        >
          <span className="grid h-9 w-9 place-items-center rounded-sm bg-forest text-paper-raised">
            <Leaf size={18} />
          </span>
          <span className="flex flex-col leading-none">
            <span className="font-serif text-[1.35rem] tracking-tight">
              Bioledger
            </span>
            <span className="font-mono text-[0.6rem] uppercase tracking-[0.16em] text-moss">
              field notebook
            </span>
          </span>
        </Link>

        <nav className="hidden items-center gap-6 lg:flex" aria-label="Pages">
          {NAV_ROUTES.map((r) => (
            <NavLink
              key={r.path}
              to={r.path}
              end={r.path === "/"}
              className={({ isActive }) =>
                cn(
                  "nav-underline pb-1 text-[0.85rem] font-medium tracking-[0.01em] transition-colors",
                  isActive
                    ? "is-active text-forest"
                    : "text-muted hover:text-forest",
                )
              }
            >
              {r.label}
            </NavLink>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <StatusPill health={health} modelReady={modelReady} />
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-label="Toggle navigation"
            className="grid h-10 w-10 place-items-center rounded-sm text-forest hover:bg-sage lg:hidden"
          >
            {open ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {open ? (
        <nav
          className="shell flex flex-col gap-1 border-t border-rule py-3 lg:hidden"
          aria-label="Pages"
        >
          {NAV_ROUTES.map((r) => (
            <NavLink
              key={r.path}
              to={r.path}
              end={r.path === "/"}
              onClick={() => setOpen(false)}
              className={({ isActive }) =>
                cn(
                  "rounded-sm px-3 py-2.5 text-[0.95rem]",
                  isActive
                    ? "bg-sage text-forest"
                    : "text-muted hover:bg-sage/60 hover:text-forest",
                )
              }
            >
              {r.label}
            </NavLink>
          ))}
        </nav>
      ) : null}
    </header>
  );
}
