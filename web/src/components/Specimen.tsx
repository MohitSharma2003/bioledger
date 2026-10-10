import { Camera, MapPin, Clock, Leaf } from "lucide-react";
import { CategoryDot, categoryColor } from "./bits";
import {
  confidenceLabel,
  formatDate,
  formatTime,
  seasonOf,
  titleCase,
} from "../lib/format";
import type { Observation, SimilarResult } from "../lib/types";

export function Specimen({
  observation: o,
  similar = [],
  season = [],
  usedVision = false,
  fresh = false,
  photoURL = null,
}: {
  observation: Observation;
  similar?: SimilarResult[];
  season?: { species: string; count: number }[];
  usedVision?: boolean;
  fresh?: boolean;
  photoURL?: string | null;
}) {
  const conf = confidenceLabel(o.confidence);
  return (
    <article className="rounded-sm border border-rule-strong/80 bg-paper-raised shadow-specimen">
      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-rule px-6 py-5">
        <div>
          <p className="field-label mb-2 flex items-center gap-2">
            <CategoryDot category={o.category} />
            {titleCase(o.category)}
            {usedVision ? (
              <span className="ml-1 inline-flex items-center gap-1 text-ochre">
                <Camera size={12} /> from photo
              </span>
            ) : null}
          </p>
          <h3 className="display-title text-[1.9rem] leading-tight">
            {o.species}
          </h3>
          {o.common_name ? (
            <p className="mt-0.5 font-serif text-lg italic text-moss">
              {o.common_name}
            </p>
          ) : null}
        </div>
        <span
          className="rounded-full px-3 py-1 font-mono text-[0.66rem] uppercase tracking-[0.08em]"
          style={{
            color: categoryColor(o.category),
            backgroundColor: `${categoryColor(o.category)}1f`,
          }}
        >
          {conf} · {Math.round(o.confidence * 100)}%
        </span>
      </header>

      <div className="grid gap-px bg-rule sm:grid-cols-3">
        <Meta icon={<Clock size={13} />} label="Recorded">
          {formatDate(o.created_at)}
          <span className="text-muted/80"> · {formatTime(o.created_at)}</span>
        </Meta>
        <Meta icon={<MapPin size={13} />} label="Place">
          {o.place || "—"}
        </Meta>
        <Meta icon={<Leaf size={13} />} label="Season">
          {seasonOf(o.created_at)}
        </Meta>
      </div>

      {photoURL ? (
        <div className="border-b border-rule px-6 py-5">
          <img
            src={photoURL}
            alt={o.species}
            className="max-h-72 w-full rounded-sm object-cover"
          />
        </div>
      ) : null}

      <div className="px-6 py-5">
        <p className="font-serif text-[1.12rem] leading-relaxed text-ink">
          {o.note || o.text}
        </p>
        {o.season_note ? (
          <p className="mt-3 border-l-2 border-moss-soft pl-4 font-serif text-[0.98rem] italic text-muted">
            {o.season_note}
          </p>
        ) : null}

        {o.tags?.length ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {o.tags.map((t) => (
              <span
                key={t}
                className="rounded-full border border-rule bg-sage/40 px-2.5 py-1 font-mono text-[0.68rem] text-moss"
              >
                #{t}
              </span>
            ))}
          </div>
        ) : null}
      </div>

      {fresh && similar.length ? (
        <div className="border-t border-rule bg-sage/25 px-6 py-5">
          <p className="field-label mb-3">Similar past sightings</p>
          <ul className="space-y-2">
            {similar.slice(0, 3).map((s) => (
              <li
                key={s.observation.id}
                className="flex items-center justify-between gap-4 border-b border-rule/70 pb-2 last:border-0"
              >
                <span className="font-serif text-[1rem] text-forest">
                  {s.observation.species}
                  <span className="ml-2 font-sans text-[0.78rem] text-muted">
                    {s.observation.place || "unspecified"}
                  </span>
                </span>
                <span className="font-mono text-[0.68rem] text-moss">
                  {Math.round(s.score * 100)}%
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {fresh && season.length ? (
        <div className="border-t border-rule px-6 py-5">
          <p className="field-label mb-3">Also in season this week</p>
          <div className="flex flex-wrap gap-2">
            {season.slice(0, 6).map((r) => (
              <span
                key={r.species}
                className="rounded-full bg-ochre/12 px-3 py-1 font-sans text-[0.8rem] text-forest"
              >
                {r.species}
                <span className="ml-1.5 font-mono text-[0.68rem] text-ochre">
                  ×{r.count}
                </span>
              </span>
            ))}
          </div>
        </div>
      ) : null}
    </article>
  );
}

function Meta({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-paper-raised px-6 py-4">
      <div className="field-label mb-1.5 flex items-center gap-1.5">
        {icon}
        {label}
      </div>
      <div className="text-[0.92rem] text-forest">{children}</div>
    </div>
  );
}
