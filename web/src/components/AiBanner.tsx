import { WifiOff, Sparkles } from "lucide-react";
import type { Health } from "../lib/types";

export function AiBanner({
  notice,
  health,
  modelReady,
}: {
  notice: string | null;
  health: Health | null;
  modelReady: boolean;
}) {
  if (notice) {
    return (
      <div
        role="status"
        className="flex items-start gap-3 rounded-sm border border-ochre/40 bg-ochre/10 px-4 py-3.5 text-forest"
      >
        <WifiOff size={18} className="mt-0.5 shrink-0 text-ochre" />
        <p className="text-[0.9rem] leading-relaxed">
          <span className="font-medium">{notice}</span> Your entry is still saved
          to the ledger. The model will fill in the identification when it is
          reachable again.
        </p>
      </div>
    );
  }

  if (health && !modelReady) {
    return (
      <div
        role="status"
        className="flex items-start gap-3 rounded-sm border border-ochre/40 bg-ochre/10 px-4 py-3.5 text-forest"
      >
        <WifiOff size={18} className="mt-0.5 shrink-0 text-ochre" />
        <p className="text-[0.9rem] leading-relaxed">
          <span className="font-medium">The local model is not reachable.</span>{" "}
          Start Ollama with <code className="font-mono text-[0.82rem]">ollama serve</code>{" "}
          and pull a model, or keep writing. Notes are saved either way.
        </p>
      </div>
    );
  }

  if (modelReady) {
    return (
      <div className="flex items-start gap-3 rounded-sm border border-moss/30 bg-sage/50 px-4 py-3.5 text-forest">
        <Sparkles size={18} className="mt-0.5 shrink-0 text-moss" />
        <p className="text-[0.9rem] leading-relaxed">
          <span className="font-medium">{health?.model}</span> is running
          locally through Ollama. Entries stay on this machine.
        </p>
      </div>
    );
  }

  return null;
}
