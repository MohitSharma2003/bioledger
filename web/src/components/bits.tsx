import type { ReactNode } from "react";
import { cn } from "../lib/utils";

const CATEGORY_COLORS: Record<string, string> = {
  plant: "#4f6a3a",
  tree: "#4f6a3a",
  flower: "#8a9a63",
  insect: "#7d8f4b",
  bird: "#b06a2c",
  fungus: "#a8593a",
  mushroom: "#a8593a",
  mammal: "#6b533f",
  reptile: "#5c7a5a",
  amphibian: "#3f6f5f",
  fish: "#3f6f7a",
  other: "#8a8672",
};

export function categoryColor(category: string): string {
  const key = (category || "").toLowerCase().trim();
  if (CATEGORY_COLORS[key]) return CATEGORY_COLORS[key];
  for (const k of Object.keys(CATEGORY_COLORS)) {
    if (key.includes(k)) return CATEGORY_COLORS[k];
  }
  return "#8a8672";
}

export function CategoryDot({
  category,
  className,
}: {
  category: string;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={cn("inline-block h-2.5 w-2.5 shrink-0 rounded-full", className)}
      style={{ backgroundColor: categoryColor(category) }}
    />
  );
}

export function PageHeader({
  eyebrow,
  eyebrowLarge = false,
  title,
  lead,
  actions,
}: {
  eyebrow?: string;
  eyebrowLarge?: boolean;
  title: string;
  lead?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="mb-8 border-b border-rule pb-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-3xl">
          {eyebrow ? (
            <p className={cn("eyebrow mb-2", eyebrowLarge && "text-2xl sm:text-3xl")}>
              {eyebrow}
            </p>
          ) : null}
          <h1 className="display-title text-page-title">{title}</h1>
          {lead ? <p className="mt-3 text-lead text-muted">{lead}</p> : null}
        </div>
        {actions ? <div className="flex shrink-0 gap-2">{actions}</div> : null}
      </div>
    </header>
  );
}

export function EmptyState({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-sm border border-dashed border-rule-strong/70 bg-paper-raised/40 px-6 py-12 text-center text-[0.95rem] italic text-muted",
        className,
      )}
    >
      {children}
    </div>
  );
}
