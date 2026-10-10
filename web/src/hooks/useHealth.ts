import { useEffect, useState } from "react";
import { api } from "../lib/api";
import type { Health } from "../lib/types";

export interface HealthState {
  health: Health | null;
  loading: boolean;
  modelReady: boolean;
}

export function useHealth(pollMs = 20000): HealthState {
  const [health, setHealth] = useState<Health | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const next = await api.health();
        if (alive) {
          setHealth(next);
          setLoading(false);
        }
      } catch {
        if (alive) {
          setHealth(null);
          setLoading(false);
        }
      }
    };
    load();
    const t = window.setInterval(load, pollMs);
    return () => {
      alive = false;
      window.clearInterval(t);
    };
  }, [pollMs]);

  const modelReady = Boolean(health?.ollama && health.model_present);
  return { health, loading, modelReady };
}
