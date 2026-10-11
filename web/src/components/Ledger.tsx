import { EmptyState } from "./bits";
import type { Stats, TimelineDay } from "../lib/types";
import { formatDayLabel } from "../lib/format";

function Stat({ value, label }: { value: number | string; label: string }) {
  return (
    <div className="rounded-sm border border-rule bg-paper-raised px-5 py-4">
      <div className="font-serif text-[2.4rem] leading-none text-forest">
        {value}
      </div>
      <div className="mt-2 font-mono text-[0.66rem] uppercase tracking-[0.1em] text-muted">
        {label}
      </div>
    </div>
  );
}

export function Ledger({
  stats,
  timeline,
}: {
  stats: Stats | null;
  timeline: TimelineDay[];
}) {
  const max = Math.max(1, ...timeline.map((d) => d.count));
  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat value={stats?.total ?? 0} label="Sightings" />
        <Stat value={stats?.species ?? 0} label="Species" />
        <Stat value={stats?.this_week ?? 0} label="This week" />
        <Stat value={stats?.streak_days ?? 0} label="Day streak" />
      </div>

      <div className="rounded-sm border border-rule bg-paper-raised p-6">
        <div className="mb-5 flex items-baseline justify-between">
          <p className="field-label">Sightings, last {timeline.length} days</p>
          <p className="font-mono text-[0.68rem] text-muted">
            peak {max === 1 && timeline.length === 0 ? 0 : max}/day
          </p>
        </div>
        {timeline.length ? (
          <div className="flex h-40 items-end gap-[3px]" role="img" aria-label="Daily sighting counts">
            {timeline.map((d, i) => (
              <div
                key={d.date}
                className="group relative flex-1 rounded-t-[2px] bg-olive/70 transition-colors hover:bg-ochre"
                style={{ height: `${Math.max(3, (d.count / max) * 100)}%` }}
                title={`${formatDayLabel(d.date)}: ${d.count}`}
              >
                {i % 6 === 0 || i === timeline.length - 1 ? (
                  <span className="absolute -bottom-6 left-0 font-mono text-[0.6rem] text-muted">
                    {formatDayLabel(d.date)}
                  </span>
                ) : null}
              </div>
            ))}
          </div>
        ) : (
          <EmptyState>No sightings yet. Record one above.</EmptyState>
        )}
      </div>

      {stats?.top_species?.length ? (
        <div className="rounded-sm border border-rule bg-paper-raised p-6">
          <p className="field-label mb-4">Most recorded</p>
          <ul className="space-y-3">
            {stats.top_species.slice(0, 5).map((s) => {
              const pct = stats.total ? (s.count / stats.total) * 100 : 0;
              return (
                <li key={s.species} className="flex items-center gap-4">
                  <span className="w-44 shrink-0 truncate font-serif text-[1rem] text-forest">
                    {s.species}
                  </span>
                  <span className="h-2 flex-1 overflow-hidden rounded-full bg-sage">
                    <span
                      className="block h-full rounded-full bg-moss"
                      style={{ width: `${Math.max(4, pct)}%` }}
                    />
                  </span>
                  <span className="w-8 shrink-0 text-right font-mono text-[0.72rem] text-muted">
                    {s.count}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
