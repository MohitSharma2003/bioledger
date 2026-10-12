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
  eyebrowClassName,
  title,
  titleClassName,
  lead,
  leadClassName,
  actions,
}: {
  eyebrow?: string;
  eyebrowClassName?: string;
  title: string;
  titleClassName?: string;
  lead?: string;
  leadClassName?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="mb-8 border-b border-rule pb-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0 max-w-3xl">
          {eyebrow ? (
            <p className={cn("eyebrow mb-2", eyebrowClassName)}>{eyebrow}</p>
          ) : null}
          <h1 className={cn("display-title", titleClassName ?? "text-page-title")}>
            {title}
          </h1>
          {lead ? (
            <p className={cn("mt-3 text-muted", leadClassName ?? "text-lead")}>
              {lead}
            </p>
          ) : null}
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
