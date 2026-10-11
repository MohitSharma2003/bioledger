import { useState } from "react";
import { NewSighting } from "../components/NewSighting";
import { AiBanner } from "../components/AiBanner";
import { PageHeader } from "../components/bits";
import { useApp } from "../lib/app-context";

export function NewSightingPage() {
  const { health, modelReady } = useApp();
  const [notice, setNotice] = useState<string | null>(null);

  return (
    <>
      <PageHeader
        eyebrow="Field notebook"
        title="Write down what you find outside."
        lead="Type a few words about a sighting. The local model turns it into a structured field note: species, confidence, tags, and what else is around. It runs on your machine, so it keeps working with no internet."
      />

      <div className="mb-8">
        <AiBanner notice={notice} health={health} modelReady={modelReady} />
      </div>

      <NewSighting modelReady={modelReady} onResult={setNotice} />
    </>
  );
}
