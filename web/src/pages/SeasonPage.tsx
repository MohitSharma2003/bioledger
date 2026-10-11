import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "../components/bits";
import { InSeason } from "../components/InSeason";
import { api } from "../lib/api";
import { monthName } from "../lib/format";
import type { SeasonRow } from "../lib/types";

export function SeasonPage() {
  const [season, setSeason] = useState<SeasonRow[]>([]);
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.season();
      setSeason(res.species ?? []);
      setMonth(res.month);
    } catch {
      setSeason([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

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
        title="In season"
        lead={`Species you have recorded in ${monthName(month)}, pulled from the dates in your own ledger. This summarises your records for the current calendar month. It is not a live ecological feed, and a species missing here may simply not have been logged yet.`}
      />
      <InSeason
        season={season}
        month={month}
        onSeed={seed}
        seeding={seeding}
        loading={loading}
      />
    </>
  );
}
