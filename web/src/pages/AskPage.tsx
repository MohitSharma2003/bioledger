import { PageHeader } from "../components/bits";
import { AskJournal } from "../components/AskJournal";
import { useApp } from "../lib/app-context";

export function AskPage() {
  const { openDetail } = useApp();
  return (
    <>
      <PageHeader
        eyebrow="Journal"
        title="Ask the journal"
        lead="Ask a question about your own sightings. The model answers using your recent entries, and every source it was given is listed below the answer so you can check it."
      />
      <AskJournal onOpenSource={openDetail} />
    </>
  );
}
