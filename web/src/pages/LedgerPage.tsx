import { useEffect, useState } from "react";
import { PageHeader } from "../components/bits";
import { Ledger } from "../components/Ledger";
import { api } from "../lib/api";
import type { Stats, TimelineDay } from "../lib/types";

export function LedgerPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [timeline, setTimeline] = useState<TimelineDay[]>([]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [s, t] = await Promise.all([api.stats(), api.timeline(30)]);
        if (!alive) return;
        setStats(s);
        setTimeline(t.days ?? []);
      } catch {
        /* leave empty */
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  return (
    <>
      <PageHeader
        eyebrow="Ledger"
        title="My ledger"
        lead="Totals and streaks from the records you have saved. A streak counts consecutive days with at least one sighting, counting back from today."
      />
      <Ledger stats={stats} timeline={timeline} />
    </>
  );
}
