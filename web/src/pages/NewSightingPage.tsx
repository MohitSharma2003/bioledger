import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { MessageCircleQuestion, NotebookPen } from "lucide-react";
import { NewSighting } from "../components/NewSighting";
import { AiBanner } from "../components/AiBanner";
import { PageHeader } from "../components/bits";
import { Button, buttonVariants } from "../components/ui/button";
import { api } from "../lib/api";
import { cn } from "../lib/utils";
import type { Stats } from "../lib/types";

export function NewSightingPage() {
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
        eyebrowClassName="mt-2 mb-12 text-4xl sm:mb-16 sm:text-5xl"
        title="Write down what you find outside."
        lead="Type a few words about a sighting. The local model turns it into a structured field note: species, confidence, tags, and what else is around. It runs on your machine, so it keeps working with no internet."
        leadClassName="max-w-2xl text-[0.95rem] leading-relaxed"
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
        <AiBanner notice={notice} />
      </div>

      <NewSighting
        onResult={setNotice}
        onLogged={refreshStats}
      />
    </>
  );
}

function LedgerGlance({ stats }: { stats: Stats | null }) {
  return (
    <aside className="w-full rounded-sm border border-rule bg-paper-raised/70 px-6 py-5 shadow-specimen sm:w-auto sm:px-[1.875rem] sm:py-6">
      <p className="field-label mb-3 text-[1rem] sm:mb-4 sm:text-[1.17rem]">Your ledger</p>
      <div className="flex items-end gap-6 sm:gap-12">
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
      <div className={cn("font-serif text-[3.25rem] leading-none sm:text-[5.625rem]", tone)}>{value}</div>
      <div className="mt-[0.375rem] font-mono text-[0.8rem] uppercase tracking-[0.1em] text-muted sm:mt-[0.5625rem] sm:text-[1.08rem]">
        {label}
      </div>
    </div>
  );
}
