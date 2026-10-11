import { useCallback, useEffect, useState } from "react";
import { Database } from "lucide-react";
import { PageHeader } from "../components/bits";
import { Sightings } from "../components/Sightings";
import { Button } from "../components/ui/button";
import { useApp } from "../lib/app-context";
import { api } from "../lib/api";
import type { CategoryCount, Observation } from "../lib/types";

export function SightingsPage() {
  const { openDetail } = useApp();
  const [observations, setObservations] = useState<Observation[]>([]);
  const [categories, setCategories] = useState<CategoryCount[]>([]);
  const [total, setTotal] = useState(0);
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [category, setCategory] = useState("");
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedQ(q.trim()), 250);
    return () => window.clearTimeout(t);
  }, [q]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [rows, cats] = await Promise.all([
        api.observations({ limit: 100, q: debouncedQ, category }),
        api.categories(),
      ]);
      setObservations(rows);
      setCategories(cats.categories ?? []);
    } catch {
      setObservations([]);
    } finally {
      setLoading(false);
    }
  }, [debouncedQ, category]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    api
      .stats()
      .then((s) => setTotal(s.total))
      .catch(() => setTotal(0));
  }, [observations.length]);

  async function seed() {
    setSeeding(true);
    try {
      await api.seed();
      await load();
    } finally {
      setSeeding(false);
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Ledger"
        title="My sightings"
        lead="Every record you have saved, newest first. Search by species, note, or place, or narrow the list by category. Records loaded from the sample data are tagged."
        actions={
          <Button variant="outline" size="sm" onClick={seed} disabled={seeding}>
            <Database size={15} />
            {seeding ? "Loading..." : "Load sample week"}
          </Button>
        }
      />

      <Sightings
        observations={observations}
        categories={categories}
        q={q}
        onQ={setQ}
        category={category}
        onCategory={setCategory}
        total={total}
        onOpen={openDetail}
        loading={loading}
      />
    </>
  );
}
