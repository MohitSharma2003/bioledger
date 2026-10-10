import { useCallback, useEffect, useState } from "react";
import { Navbar } from "./components/Navbar";
import { Overview } from "./components/Overview";
import { NewSighting } from "./components/NewSighting";
import { AskJournal } from "./components/AskJournal";
import { Ledger } from "./components/Ledger";
import { InSeason } from "./components/InSeason";
import { Sightings } from "./components/Sightings";
import { DetailDialog } from "./components/DetailDialog";
import { SectionHeading } from "./components/bits";
import { useHealth } from "./hooks/useHealth";
import { useScrollSpy } from "./hooks/useScrollSpy";
import { SECTIONS } from "./lib/sections";
import { api } from "./lib/api";
import type {
  CategoryCount,
  Observation,
  SeasonRow,
  Stats,
  TimelineDay,
} from "./lib/types";

export default function App() {
  const { health, modelReady } = useHealth();
  const active = useScrollSpy(SECTIONS.map((s) => s.id));

  const [stats, setStats] = useState<Stats | null>(null);
  const [timeline, setTimeline] = useState<TimelineDay[]>([]);
  const [season, setSeason] = useState<SeasonRow[]>([]);
  const [categories, setCategories] = useState<CategoryCount[]>([]);
  const [observations, setObservations] = useState<Observation[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [seeding, setSeeding] = useState(false);

  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [category, setCategory] = useState("");

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedQ(q.trim()), 250);
    return () => window.clearTimeout(t);
  }, [q]);

  const refreshSummary = useCallback(async () => {
    try {
      const [s, t, se, c] = await Promise.all([
        api.stats(),
        api.timeline(30),
        api.season(),
        api.categories(),
      ]);
      setStats(s);
      setTimeline(t.days ?? []);
      setSeason(se.species ?? []);
      setCategories(c.categories ?? []);
    } catch {
      /* keep last good state */
    }
  }, []);

  const refreshObservations = useCallback(async () => {
    try {
      const rows = await api.observations({
        limit: 100,
        q: debouncedQ,
        category,
      });
      setObservations(rows);
    } catch {
      setObservations([]);
    }
  }, [debouncedQ, category]);

  useEffect(() => {
    refreshSummary();
  }, [refreshSummary]);

  useEffect(() => {
    refreshObservations();
  }, [refreshObservations]);

  const onLogged = useCallback(() => {
    refreshSummary();
    refreshObservations();
  }, [refreshSummary, refreshObservations]);

  async function seed() {
    setSeeding(true);
    try {
      await api.seed();
      setNotice(null);
      await Promise.all([refreshSummary(), refreshObservations()]);
    } finally {
      setSeeding(false);
    }
  }

  return (
    <div className="relative z-[2]">
      <Navbar active={active} health={health} modelReady={modelReady} />

      <main className="shell pb-24">
        <Overview
          notice={notice}
          health={health}
          modelReady={modelReady}
          total={stats?.total ?? 0}
          species={stats?.species ?? 0}
        />

        <Section
          id="new-sighting"
          index="01 — record"
          title="New sighting"
          description="Describe what you saw in your own words. An open-weight model reads it and drafts the field note."
        >
          <NewSighting
            modelReady={modelReady}
            onLogged={onLogged}
            onResult={setNotice}
          />
        </Section>

        <Section
          id="ask"
          index="02 — query"
          title="Ask the journal"
          description="Search your own notebook in plain language. Answers are grounded in the sightings you recorded."
        >
          <AskJournal onOpenSource={setSelectedId} />
        </Section>

        <Section
          id="ledger"
          index="03 — measure"
          title="My ledger"
          description="The shape of your noticing over time — totals, streaks, and the last thirty days."
        >
          <Ledger stats={stats} timeline={timeline} />
        </Section>

        <Section
          id="season"
          index="04 — context"
          title="In season"
          description="What is active around you this week, drawn from the notes already in the ledger."
        >
          <InSeason season={season} onSeed={seed} seeding={seeding} />
        </Section>

        <Section
          id="sightings"
          index="05 — browse"
          title="Sightings"
          description="Every record in the ledger. Search by name, note, or place, or filter by category."
        >
          <Sightings
            observations={observations}
            categories={categories}
            q={q}
            onQ={setQ}
            category={category}
            onCategory={setCategory}
            total={stats?.total ?? 0}
            onOpen={setSelectedId}
            onSeed={seed}
            seeding={seeding}
          />
        </Section>
      </main>

      <footer className="shell border-t border-rule py-8">
        <p className="font-mono text-[0.68rem] uppercase tracking-[0.1em] text-muted">
          Bioledger · local-first field notebook · open-weight model via Ollama
        </p>
      </footer>

      <DetailDialog id={selectedId} onClose={() => setSelectedId(null)} />
    </div>
  );
}

function Section({
  id,
  index,
  title,
  description,
  children,
}: {
  id: string;
  index: string;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="section-anchor pt-16 sm:pt-20">
      <SectionHeading index={index} title={title} description={description} />
      <div className="mt-8">{children}</div>
    </section>
  );
}
