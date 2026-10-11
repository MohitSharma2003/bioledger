import { createContext, useContext } from "react";
import type { Health } from "./types";

export interface AppContextValue {
  health: Health | null;
  modelReady: boolean;
  /** Open the shared detail dialog for a saved record. */
  openDetail: (id: number) => void;
}

export const AppContext = createContext<AppContextValue | null>(null);

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used inside AppContext.Provider");
  return ctx;
}
