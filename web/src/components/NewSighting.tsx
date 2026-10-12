import { useRef, useState } from "react";
import { ImagePlus, Loader2, NotebookPen, X } from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";
import { Specimen } from "./Specimen";
import { EmptyState } from "./bits";
import { useModels } from "../lib/models/context";
import type { ObserveResponse } from "../lib/types";

export function NewSighting({
  onLogged,
  onResult,
}: {
  onLogged?: () => void;
  onResult: (notice: string | null) => void;
}) {
  const { parseSighting, ready } = useModels();
  const [text, setText] = useState("");
  const [place, setPlace] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<ObserveResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function pickPhoto(file: File | null) {
    if (preview) URL.revokeObjectURL(preview);
    setPhoto(file);
    setPreview(file ? URL.createObjectURL(file) : null);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim() || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await parseSighting({
        text: text.trim(),
        place: place.trim(),
        photo,
      });
      setResult(res);
      onResult(res.ai_processed ? null : res.notice || "The model was unavailable.");
      onLogged?.();
      setText("");
      setPlace("");
      pickPhoto(null);
      if (fileRef.current) fileRef.current.value = "";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="grid gap-8 lg:grid-cols-2 lg:gap-10">
      <form onSubmit={submit} className="space-y-5">
        <div>
          <label
            htmlFor="text"
            className="field-label mb-3 block text-xl sm:text-2xl"
          >
            What did you notice?
          </label>
          <Textarea
            id="text"
            rows={7}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="e.g. A low shrub with grey-green leaves and tiny purple flowers along the fence line, bees all over it."
            required
          />
        </div>

        <div>
          <label htmlFor="place" className="field-label mb-2 block">
            Where
          </label>
          <Input
            id="place"
            value={place}
            onChange={(e) => setPlace(e.target.value)}
            placeholder="Back garden, north fence"
          />
        </div>

        <div>
          <span className="field-label mb-2 block">Photo (optional)</span>
          {preview ? (
            <div className="relative overflow-hidden rounded-sm border border-rule-strong">
              <img src={preview} alt="Selected" className="max-h-60 w-full object-cover" />
              <button
                type="button"
                onClick={() => {
                  pickPhoto(null);
                  if (fileRef.current) fileRef.current.value = "";
                }}
                className="absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-full bg-forest/80 text-paper-raised hover:bg-forest"
                aria-label="Remove photo"
              >
                <X size={16} />
              </button>
            </div>
          ) : (
            <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-sm border border-dashed border-rule-strong/70 bg-paper-raised/40 px-6 py-9 text-center transition-colors hover:border-moss hover:bg-sage/30">
              <ImagePlus size={22} className="text-moss" />
              <span className="text-[0.9rem] text-forest">
                Drop or choose a photo
              </span>
              <span className="font-mono text-[0.66rem] uppercase tracking-[0.08em] text-muted">
                jpg · png · webp
              </span>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => pickPhoto(e.target.files?.[0] ?? null)}
              />
            </label>
          )}
        </div>

        {error ? (
          <p className="rounded-sm border border-alert/40 bg-alert/10 px-3.5 py-2.5 text-[0.88rem] text-alert">
            {error}
          </p>
        ) : null}

        <div className="flex items-center gap-4">
          <Button type="submit" size="lg" disabled={submitting || !text.trim()}>
            {submitting ? (
              <>
                <Loader2 size={16} className="animate-spin" /> Writing the note...
              </>
            ) : (
              <>
                <NotebookPen size={16} /> Record sighting
              </>
            )}
          </Button>
          <span className="font-mono text-[0.68rem] uppercase tracking-[0.08em] text-muted">
            {ready ? "model ready" : "saves offline"}
          </span>
        </div>
      </form>

      <div className="lg:pt-7">
        {result ? (
          <Specimen
            observation={result.observation}
            similar={result.similar}
            season={result.in_season}
            usedVision={result.used_vision}
            fresh
          />
        ) : (
          <EmptyState className="flex h-full min-h-[340px] flex-col items-center justify-center gap-3">
            <NotebookPen size={26} className="text-moss/70" />
            <span>
              Your field note appears here: identification, confidence, and
              similar records from the ledger.
            </span>
          </EmptyState>
        )}
      </div>
    </div>
  );
}
