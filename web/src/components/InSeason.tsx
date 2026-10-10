import { EmptyState } from "./bits";
import type { SeasonRow } from "../lib/types";

export function InSeason({
  season,
  onSeed,
  seeding,
}: {
  season: SeasonRow[];
  onSeed: () => void;
  seeding: boolean;
}) {
  const max = Math.max(1, ...season.map((s) => s.count));
  return (
    <div className="rounded-sm border border-rule bg-paper-raised p-6 shadow-specimen">
      <div className="mb-5 flex items-baseline justify-between gap-4">
        <p className="field-label">Flowering &amp; active this week</p>
        <button
          type="button"
          onClick={onSeed}
          disabled={seeding}
          className="font-mono text-[0.68rem] uppercase tracking-[0.08em] text-moss underline-offset-4 hover:underline disabled:opacity-50"
        >
          {seeding ? "loading…" : "load sample week"}
        </button>
      </div>

      {season.length ? (
        <ul className="space-y-4">
          {season.slice(0, 8).map((s) => (
            <li key={s.species}>
              <div className="mb-1.5 flex items-baseline justify-between gap-3">
                <span className="font-serif text-[1.1rem] text-forest">
                  {s.species}
                </span>
                <span className="font-mono text-[0.7rem] text-muted">
                  ×{s.count}
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
          Nothing logged in the last seven days yet — the season list fills in
          as you record sightings.
        </EmptyState>
      )}
    </div>
  );
}
