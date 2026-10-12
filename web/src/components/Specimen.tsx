import { useEffect, useState } from "react";
import { Camera, MapPin, Clock, Leaf } from "lucide-react";
import { CategoryDot, categoryColor } from "./bits";
import { formatDate, formatTime, seasonOf, titleCase } from "../lib/format";
import { getPhotoURL } from "../lib/photos";
import type { Observation, SimilarResult } from "../lib/types";

export function Specimen({
  observation: o,
  similar = [],
  season = [],
  usedVision = false,
  fresh = false,
}: {
  observation: Observation;
  similar?: SimilarResult[];
  season?: { species: string; count: number }[];
  usedVision?: boolean;
  fresh?: boolean;
}) {
  const pct = Math.round(o.confidence * 100);
  return (
    <article className="rounded-sm border border-rule-strong/80 bg-paper-raised shadow-specimen">
      <header className="flex flex-wrap items-start justify-between gap-5 border-b border-rule px-6 py-5">
        <div>
          <p className="field-label mb-2 flex items-center gap-2">
            <CategoryDot category={o.category} />
            {titleCase(o.category)}
            {usedVision ? (
              <span className="ml-1 inline-flex items-center gap-1 text-ochre">
                <Camera size={12} /> from photo
              </span>
            ) : null}
            {o.source === "demo" ? (
              <span className="ml-1 rounded-full border border-ochre/50 px-2 py-0.5 text-[0.6rem] normal-case tracking-normal text-ochre">
                sample
              </span>
            ) : null}
          </p>
          <h3 className="species-name">{o.species}</h3>
          {o.common_name ? (
            <p className="mt-1 font-serif text-lg italic text-moss">
              {o.common_name}
            </p>
          ) : null}
        </div>

        <div
          className="min-w-[150px]"
          title="The model's own estimate of how sure it is, from 0 to 100%."
        >
          <div className="field-label mb-1.5 text-right">Confidence</div>
          <div className="flex items-center justify-end gap-2">
            <span className="h-1.5 w-24 overflow-hidden rounded-full bg-sage">
              <span
                className="block h-full rounded-full"
                style={{
                  width: `${pct}%`,
                  backgroundColor: categoryColor(o.category),
                }}
              />
            </span>
            <span className="w-9 text-right font-mono text-[0.7rem] text-muted">
              {pct}%
            </span>
          </div>
        </div>
      </header>

      <div className="grid gap-px bg-rule sm:grid-cols-3">
        <Meta icon={<Clock size={13} />} label="Recorded">
          {formatDate(o.created_at)}
          <span className="text-muted/80"> · {formatTime(o.created_at)}</span>
        </Meta>
        <Meta icon={<MapPin size={13} />} label="Place">
          {o.place || "not recorded"}
        </Meta>
        <Meta icon={<Leaf size={13} />} label="Season">
          {seasonOf(o.created_at)}
        </Meta>
      </div>

      <SpecimenPhoto observation={o} />

      <div className="px-6 py-5">
        <p className="text-[1.05rem] leading-relaxed text-ink">
          {o.note || o.text}
        </p>
        {o.season_note ? (
          <p className="mt-3 border-l-2 border-moss-soft pl-4 text-[0.95rem] italic text-muted">
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
          <p className="field-label mb-3">Also logged this month</p>
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

/**
 * The photo for a sighting, from the server when it has one, otherwise from
 * the browser's offline cache. A broken or missing file simply hides the image
 * instead of leaving a broken frame; the note is never affected.
 */
function SpecimenPhoto({ observation: o }: { observation: Observation }) {
  const [url, setUrl] = useState<string | null>(o.photo_url ?? null);

  useEffect(() => {
    let alive = true;
    let created: string | null = null;
    setUrl(o.photo_url ?? null);
    if (!o.photo_url) {
      getPhotoURL(o.id)
        .then((local) => {
          if (!alive || !local) return;
          created = local;
          setUrl(local);
        })
        .catch(() => undefined);
    }
    return () => {
      alive = false;
      if (created) URL.revokeObjectURL(created);
    };
  }, [o.id, o.photo_url]);

  if (!url) return null;
  return (
    <div className="border-b border-rule px-6 py-5">
      <img
        src={url}
        alt={o.species}
        className="max-h-72 w-full rounded-sm object-cover"
        onError={() => setUrl(null)}
      />
    </div>
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
