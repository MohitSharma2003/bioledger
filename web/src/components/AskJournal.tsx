import { useState } from "react";
import { Loader2, MessageCircleQuestion, Quote } from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { api } from "../lib/api";
import { formatDate } from "../lib/format";
import { CategoryDot } from "./bits";
import type { Observation } from "../lib/types";

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

  async function ask(e: React.FormEvent) {
    e.preventDefault();
    if (!question.trim() || loading) return;
    setLoading(true);
    setError(null);
    setAnswer(null);
    try {
      const res = await api.ask(question.trim());
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
        <Button type="submit" size="md" disabled={loading || !question.trim()} className="shrink-0">
          {loading ? <Loader2 size={16} className="animate-spin" /> : <MessageCircleQuestion size={16} />}
          Ask
        </Button>
      </form>

      {error ? (
        <p className="mt-4 rounded-sm border border-alert/40 bg-alert/10 px-3.5 py-2.5 text-[0.88rem] text-alert">
          {error}
        </p>
      ) : null}

      {answer ? (
        <div className="mt-6 rounded-sm border border-rule bg-paper-raised p-6 shadow-specimen">
          <Quote size={20} className="text-moss" />
          <p className="mt-3 font-serif text-[1.2rem] leading-relaxed text-forest">
            {answer}
          </p>
          <p className="mt-4 font-mono text-[0.66rem] uppercase tracking-[0.08em] text-muted">
            answered {mode === "semantic" ? "from similar notes" : "from the ledger"}
          </p>
          {sources.length ? (
            <div className="mt-5 border-t border-rule pt-4">
              <p className="field-label mb-3">Based on</p>
              <ul className="space-y-1.5">
                {sources.slice(0, 4).map((s) => (
                  <li key={s.id}>
                    <button
                      type="button"
                      onClick={() => onOpenSource(s.id)}
                      className="flex w-full items-center justify-between gap-4 rounded-sm px-2 py-1.5 text-left transition-colors hover:bg-sage/50"
                    >
                      <span className="flex items-center gap-2.5 text-[0.92rem] text-forest">
                        <CategoryDot category={s.category} />
                        {s.species}
                      </span>
                      <span className="font-mono text-[0.68rem] text-muted">
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
