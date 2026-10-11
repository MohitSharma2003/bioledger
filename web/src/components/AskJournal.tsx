import { useState } from "react";
import { Loader2, MessageCircleQuestion, Quote } from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { api } from "../lib/api";
import { formatDate } from "../lib/format";
import { CategoryDot } from "./bits";
import { cn } from "../lib/utils";
import type { Observation } from "../lib/types";

const EXAMPLES = [
  "When did I last see bees on the lavender?",
  "Where have I recorded foxgloves?",
  "What did I note about the pond this summer?",
];

export function AskJournal({
  onOpenSource,
}: {
  onOpenSource: (id: number) => void;
}) {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<string | null>(null);
  const [sources, setSources] = useState<Observation[]>([]);
  const [mode, setMode] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [asked, setAsked] = useState<string>("");

  async function ask(e: React.FormEvent) {
    e.preventDefault();
    if (!question.trim() || loading) return;
    const q = question.trim();
    setLoading(true);
    setError(null);
    setAnswer(null);
    setAsked(q);
    try {
      const res = await api.ask(q);
      setAnswer(res.answer);
      setSources(res.sources ?? []);
      setMode(res.mode);
    } catch (err) {
      setError(err instanceof Error ? err.message : "The journal could not answer.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-3xl">
      <form onSubmit={ask} className="flex flex-col gap-3 sm:flex-row">
        <Input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="When did I last see bees on the lavender?"
          aria-label="Ask the journal"
        />
        <Button
          type="submit"
          size="md"
          disabled={loading || !question.trim()}
          className="shrink-0"
        >
          {loading ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <MessageCircleQuestion size={16} />
          )}
          Ask
        </Button>
      </form>

      <div className="mt-3 flex flex-wrap gap-2">
        {EXAMPLES.map((ex) => (
          <button
            key={ex}
            type="button"
            onClick={() => setQuestion(ex)}
            className={cn(
              "rounded-full border border-rule-strong/60 px-3 py-1 text-[0.8rem] text-muted transition-colors",
              "hover:border-moss hover:text-forest",
            )}
          >
            {ex}
          </button>
        ))}
      </div>

      {error ? (
        <p className="mt-4 rounded-sm border border-alert/40 bg-alert/10 px-3.5 py-2.5 text-[0.88rem] text-alert">
          {error}
        </p>
      ) : null}

      {answer ? (
        <div className="mt-6 rounded-sm border border-rule bg-paper-raised p-6 shadow-specimen">
          <Quote size={20} className="text-moss" />
          <p className="mt-3 text-[1.15rem] leading-relaxed text-forest">
            {answer}
          </p>
          <p className="mt-4 font-mono text-[0.66rem] uppercase tracking-[0.08em] text-muted">
            {mode === "model"
              ? "answered by the local model from the entries below"
              : "the local model was not reachable, so this is a fixed reply"}
          </p>
          {sources.length && asked ? (
            <div className="mt-5 border-t border-rule pt-4">
              <p className="field-label mb-1">Recent entries in context</p>
              <p className="mb-3 text-[0.82rem] text-muted">
                The model was given these records when answering. It was not told
                which ones matter, so treat the answer as a lead, not a citation.
              </p>
              <ul className="space-y-1.5">
                {sources.slice(0, 6).map((s) => (
                  <li key={s.id}>
                    <button
                      type="button"
                      onClick={() => onOpenSource(s.id)}
                      className="flex w-full items-center justify-between gap-4 rounded-sm px-2 py-1.5 text-left transition-colors hover:bg-sage/50"
                    >
                      <span className="flex min-w-0 items-center gap-2.5 text-[0.92rem] text-forest">
                        <CategoryDot category={s.category} />
                        <span className="truncate">{s.species}</span>
                      </span>
                      <span className="shrink-0 font-mono text-[0.68rem] text-muted">
                        {formatDate(s.created_at)}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
