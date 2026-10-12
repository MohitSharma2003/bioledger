import { useEffect, useState } from "react";

/**
 * PWA plumbing: make the deployed site installable ("downloaded as an app")
 * and usable offline.
 *
 * The service worker caches the app shell; the browser-cached Gemma 4 E2B
 * weights are handled separately by Transformers.js, so once the optional
 * model has been downloaded the installed app is fully self-contained.
 */

export function registerServiceWorker(): void {
  if (import.meta.env.DEV) return; // the dev server does not serve /sw.js
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
      // Offline support is a bonus; never let it break the app.
    });
  });
}

// Not in the standard DOM lib yet, so describe the slice we use.
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export interface InstallPrompt {
  canInstall: boolean;
  installed: boolean;
  install: () => Promise<void>;
}

const DISMISSED_KEY = "bioledger.install.dismissed";

export function useInstallPrompt(): InstallPrompt {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const standalone =
      window.matchMedia?.("(display-mode: standalone)").matches ||
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
    if (standalone) setInstalled(true);

    function onPrompt(event: Event) {
      event.preventDefault();
      try {
        if (localStorage.getItem(DISMISSED_KEY) === "1") return;
      } catch {
        /* storage may be blocked; still offer the install */
      }
      setDeferred(event as BeforeInstallPromptEvent);
    }
    function onInstalled() {
      setInstalled(true);
      setDeferred(null);
    }

    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  async function install() {
    if (!deferred) return;
    await deferred.prompt();
    const choice = await deferred.userChoice;
    if (choice.outcome === "dismissed") {
      try {
        localStorage.setItem(DISMISSED_KEY, "1");
      } catch {
        /* ignore */
      }
    }
    setDeferred(null);
  }

  return { canInstall: Boolean(deferred) && !installed, installed, install };
}
