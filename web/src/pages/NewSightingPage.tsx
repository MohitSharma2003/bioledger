import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { MessageCircleQuestion, NotebookPen } from "lucide-react";
import { NewSighting } from "../components/NewSighting";
import { AiBanner } from "../components/AiBanner";
import { PageHeader } from "../components/bits";
import { Button, buttonVariants } from "../components/ui/button";
import { useApp } from "../lib/app-context";
import { api } from "../lib/api";
import { cn } from "../lib/utils";
import type { Stats } from "../lib/types";

export function NewSightingPage() {
  const { health, modelReady } = useApp();
  const [notice, setNotice] = useState<string | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);

  const refreshStats = useCallback(() => {
    api
      .stats()
      .then(setStats)
      .catch(() => {
        /* keep last good value */
      });
  }, []);

  useEffect(() => {
    refreshStats();
  }, [refreshStats]);

  function focusForm() {
    const el = document.getElementById("text") as HTMLTextAreaElement | null;
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.focus();
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Field notebook"
        title="Write down what you find outside."
        lead="Type a few words about a sighting. The local model turns it into a structured field note: species, confidence, tags, and what else is around. It runs on your machine, so it keeps working with no internet."
      />

      <div className="mb-8 flex flex-col gap-6 border-b border-rule pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-wrap gap-3">
          <Button size="lg" onClick={focusForm}>
            <NotebookPen size={16} /> Log a sighting
          </Button>
          <Link
            to="/ask"
            className={cn(buttonVariants({ variant: "outline", size: "lg" }))}
          >
            <MessageCircleQuestion size={16} /> Ask the journal
          </Link>
        </div>

        <div className="flex items-end gap-8">
          <div>
            <div className="font-serif text-4xl leading-none text-forest">
              {stats?.total ?? 0}
            </div>
            <div className="mt-1.5 font-mono text-[0.68rem] uppercase tracking-[0.1em] text-muted">
              sightings
            </div>
          </div>
          <div>
            <div className="font-serif text-4xl leading-none text-moss">
              {stats?.species ?? 0}
            </div>
            <div className="mt-1.5 font-mono text-[0.68rem] uppercase tracking-[0.1em] text-muted">
              species
            </div>
          </div>
        </div>
      </div>

      <div className="mb-8">
        <AiBanner notice={notice} health={health} modelReady={modelReady} />
      </div>

      <NewSighting
        modelReady={modelReady}
        onResult={setNotice}
        onLogged={refreshStats}
      />
    </>
  );
}
