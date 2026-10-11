import { ChevronRight, Search } from "lucide-react";
import { Input } from "./ui/input";
import { CategoryDot, EmptyState } from "./bits";
import { formatDate, titleCase } from "../lib/format";
import { cn } from "../lib/utils";
import type { CategoryCount, Observation } from "../lib/types";

export function Sightings({
  observations,
  categories,
  q,
  onQ,
  category,
  onCategory,
  total,
  onOpen,
  loading = false,
}: {
  observations: Observation[];
  categories: CategoryCount[];
  q: string;
  onQ: (v: string) => void;
  category: string;
  onCategory: (v: string) => void;
  total: number;
  onOpen: (id: number) => void;
  loading?: boolean;
}) {
  const allCount = categories.reduce((sum, c) => sum + c.count, 0);

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-sm">
          <Search
            size={16}
            className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted"
          />
          <Input
            value={q}
            onChange={(e) => onQ(e.target.value)}
            placeholder="Search species, notes, places"
            className="pl-10"
            aria-label="Search sightings"
          />
        </div>
        <p className="font-mono text-[0.68rem] uppercase tracking-[0.08em] text-muted">
          showing {observations.length} of {total}
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Chip active={category === ""} onClick={() => onCategory("")}>
          All <span className="ml-1.5 opacity-60">{allCount || total}</span>
        </Chip>
        {categories.map((c) => (
          <Chip
            key={c.category}
            active={category === c.category}
            onClick={() => onCategory(c.category)}
          >
            <CategoryDot category={c.category} className="mr-2 h-2 w-2" />
            {titleCase(c.category)}
            <span className="ml-1.5 opacity-60">{c.count}</span>
          </Chip>
        ))}
      </div>

      {loading ? (
        <p className="rounded-sm border border-rule bg-paper-raised px-5 py-8 text-center text-[0.9rem] text-muted">
          Loading records...
        </p>
      ) : observations.length ? (
        <ul className="overflow-hidden rounded-sm border border-rule bg-paper-raised">
          {observations.map((o) => (
            <li key={o.id} className="border-b border-rule last:border-0">
              <button
                type="button"
                onClick={() => onOpen(o.id)}
                className="flex w-full items-center gap-4 px-5 py-3.5 text-left transition-colors hover:bg-sage/40"
              >
                <span className="w-24 shrink-0 font-mono text-[0.7rem] text-muted">
                  {formatDate(o.created_at)}
                </span>
                <CategoryDot category={o.category} />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="truncate font-serif text-[1.05rem] text-forest">
                      {o.species}
                    </span>
                    {o.source === "demo" ? (
                      <span className="shrink-0 rounded-full border border-ochre/50 px-2 py-0.5 font-mono text-[0.58rem] uppercase tracking-[0.08em] text-ochre">
                        sample
                      </span>
                    ) : null}
                  </span>
                  {o.place ? (
                    <span className="block truncate text-[0.8rem] text-muted">
                      {o.place}
                    </span>
                  ) : null}
                </span>
                <span className="hidden shrink-0 font-mono text-[0.66rem] uppercase tracking-[0.06em] text-muted sm:block">
                  {titleCase(o.category)}
                </span>
                <ChevronRight size={16} className="shrink-0 text-muted/60" />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState>
          {q || category
            ? "No sightings match that search."
            : "The ledger is empty. Record your first sighting to start filling it in."}
        </EmptyState>
      )}
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
      onClick={onClick}
      className={cn(
        "inline-flex items-center rounded-full border px-3.5 py-1.5 text-[0.82rem] transition-colors",
        active
          ? "border-forest bg-forest text-paper-raised"
          : "border-rule-strong/70 text-forest hover:bg-sage",
      )}
    >
      {children}
    </button>
  );
}
