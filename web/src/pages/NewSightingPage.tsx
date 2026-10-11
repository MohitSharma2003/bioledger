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
        eyebrowClassName="text-4xl sm:text-5xl"
        title="Write down what you find outside."
        titleClassName="text-[1.9rem] sm:text-[2.4rem]"
        lead="Type a few words about a sighting. The local model turns it into a structured field note: species, confidence, tags, and what else is around. It runs on your machine, so it keeps working with no internet."
        actions={<LedgerGlance stats={stats} />}
      />

      <div className="mb-7 flex flex-wrap gap-3">
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

function LedgerGlance({ stats }: { stats: Stats | null }) {
  return (
    <aside className="w-full rounded-sm border border-rule bg-paper-raised/70 px-5 py-4 shadow-specimen sm:w-auto">
      <p className="field-label mb-3">Your ledger</p>
      <div className="flex items-end gap-7">
        <Glance value={stats?.total ?? 0} label="sightings" tone="text-forest" />
        <Glance value={stats?.species ?? 0} label="species" tone="text-moss" />
        <Glance
          value={stats?.this_week ?? 0}
          label="this week"
          tone="text-ochre"
        />
      </div>
    </aside>
  );
}

function Glance({
  value,
  label,
  tone,
}: {
  value: number;
  label: string;
  tone: string;
}) {
  return (
    <div>
      <div className={cn("font-serif text-5xl leading-none", tone)}>{value}</div>
      <div className="mt-1.5 font-mono text-[0.66rem] uppercase tracking-[0.1em] text-muted">
        {label}
      </div>
    </div>
  );
}
