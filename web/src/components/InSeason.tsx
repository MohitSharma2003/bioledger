import { EmptyState } from "./bits";
import { monthName } from "../lib/format";
import type { SeasonRow } from "../lib/types";

export function InSeason({
  season,
  month,
  onSeed,
  seeding,
  loading = false,
}: {
  season: SeasonRow[];
  month: number;
  onSeed: () => void;
  seeding: boolean;
  loading?: boolean;
}) {
  const max = Math.max(1, ...season.map((s) => s.count));
  const total = season.reduce((sum, s) => sum + s.count, 0);

  return (
    <div className="rounded-sm border border-rule bg-paper-raised p-6 shadow-specimen">
      <div className="mb-5 flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <p className="field-label">Recorded in {monthName(month)}</p>
          <p className="mt-1 text-[0.85rem] text-muted">
            {total} {total === 1 ? "record" : "records"} across{" "}
            {season.length} {season.length === 1 ? "species" : "species"}
          </p>
        </div>
        <button
          type="button"
          onClick={onSeed}
          disabled={seeding}
          className="font-mono text-[0.68rem] uppercase tracking-[0.08em] text-moss underline-offset-4 hover:underline disabled:opacity-50"
        >
          {seeding ? "loading..." : "load sample week"}
        </button>
      </div>

      {loading ? (
        <p className="py-8 text-center text-[0.9rem] text-muted">Loading...</p>
      ) : season.length ? (
        <ul className="space-y-4">
          {season.slice(0, 8).map((s) => (
            <li key={s.species}>
              <div className="mb-1.5 flex items-baseline justify-between gap-3">
                <span className="species-name text-[1.1rem]">{s.species}</span>
                <span className="font-mono text-[0.7rem] text-muted">
                  {s.count} {s.count === 1 ? "record" : "records"}
                </span>
              </div>
              <span className="block h-1.5 overflow-hidden rounded-full bg-sage">
                <span
                  className="block h-full rounded-full bg-ochre/80"
                  style={{ width: `${Math.max(6, (s.count / max) * 100)}%` }}
                />
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState>
          Nothing recorded in {monthName(month)} yet. This list fills in as you
          log sightings during the month.
        </EmptyState>
      )}
    </div>
  );
}
