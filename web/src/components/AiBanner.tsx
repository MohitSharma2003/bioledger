import { WifiOff, Sparkles } from "lucide-react";
import { useModels } from "../lib/models/context";

export function AiBanner({ notice }: { notice: string | null }) {
  const { active, activeModel, ready, status } = useModels();

  if (notice) {
    return (
      <div
        role="status"
        className="flex items-start gap-3 rounded-sm border border-ochre/40 bg-ochre/10 px-4 py-3.5 text-forest"
      >
        <WifiOff size={18} className="mt-0.5 shrink-0 text-ochre" />
        <p className="text-[0.9rem] leading-relaxed">{notice}</p>
      </div>
    );
  }

  if (ready) {
    const where = active.providerId === "browser" ? "in this browser" : "locally through Ollama";
    return (
      <div className="flex items-start gap-3 rounded-sm border border-moss/30 bg-sage/50 px-4 py-3.5 text-forest">
        <Sparkles size={18} className="mt-0.5 shrink-0 text-moss" />
        <p className="text-[0.9rem] leading-relaxed">
          <span className="font-medium">{activeModel?.label ?? active.modelId}</span> is ready{" "}
          {where}. Entries stay on this machine.
        </p>
      </div>
    );
  }

  const reason =
    status.kind === "unsupported" || status.kind === "out_of_memory" || status.kind === "error"
      ? status.detail
      : null;

  return (
    <div
      role="status"
      className="flex items-start gap-3 rounded-sm border border-ochre/40 bg-ochre/10 px-4 py-3.5 text-forest"
    >
      <WifiOff size={18} className="mt-0.5 shrink-0 text-ochre" />
      <p className="text-[0.9rem] leading-relaxed">
        <span className="font-medium">No model is ready.</span>{" "}
        {reason ? `${reason} ` : ""}
        Pick one from the model menu up top, start Ollama with{" "}
        <code className="font-mono text-[0.82rem]">ollama serve</code>, or keep
        writing. Notes are saved either way.
      </p>
    </div>
  );
}
