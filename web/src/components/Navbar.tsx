import { useState } from "react";
import { Link, NavLink } from "react-router-dom";
import { Leaf, Menu, X } from "lucide-react";
import { cn } from "../lib/utils";
import { NAV_ROUTES } from "../lib/routes";
import { ModelSelector } from "./ModelSelector";
import { InstallApp } from "./InstallApp";

export function Navbar() {
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
          <span className="hidden flex-col leading-none sm:flex">
            <span className="font-serif text-[1.35rem] tracking-tight">
              Bioledger
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
          <InstallApp />
          <ModelSelector />
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-label="Toggle navigation"
            className="grid h-11 w-11 place-items-center rounded-sm text-forest hover:bg-sage lg:hidden"
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
                  "flex min-h-[44px] items-center rounded-sm px-3 text-[0.95rem]",
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
