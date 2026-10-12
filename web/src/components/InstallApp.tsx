import { MonitorDown } from "lucide-react";
import { cn } from "../lib/utils";
import { useInstallPrompt } from "../lib/pwa";

/**
 * "Install app" affordance. Only shown when the browser has offered an
 * install prompt (Chrome/Edge/Firefox on desktop and Android). Hidden once the
 * app is already running standalone.
 */
export function InstallApp({ className }: { className?: string }) {
  const { canInstall, install } = useInstallPrompt();
  if (!canInstall) return null;

  return (
    <button
      type="button"
      onClick={() => {
        install().catch(() => undefined);
      }}
      aria-label="Install Bioledger as an app"
      className={cn(
        "flex h-11 min-w-11 items-center justify-center gap-2 rounded-full border border-rule-strong/70 bg-paper-raised px-3 text-forest hover:bg-sage/60",
        className,
      )}
    >
      <MonitorDown size={16} className="shrink-0" />
      <span className="hidden text-[0.82rem] font-medium sm:inline">Install app</span>
    </button>
  );
}
