import { PageHeader } from "../components/bits";
import { ModelBrowser } from "../components/ModelBrowser";

export function ModelBrowserPage() {
  return (
    <>
      <PageHeader
        eyebrow="AI Model Browser"
        title="Models that run in this browser"
        lead="Pick a verified model, download it once, and use it for field notes and journal questions with no Ollama and no server inference. Search, filter by task, and manage every download here. Nothing downloads until you press Download."
      />
      <ModelBrowser />
    </>
  );
}