import { useMemo, useState } from "react";
import { Route, Routes } from "react-router-dom";
import { Navbar } from "./components/Navbar";
import { DetailDialog } from "./components/DetailDialog";
import { AppContext, type AppContextValue } from "./lib/app-context";
import { ModelsProvider } from "./lib/models/context";
import { useHealth } from "./hooks/useHealth";
import { NewSightingPage } from "./pages/NewSightingPage";
import { SightingsPage } from "./pages/SightingsPage";
import { AskPage } from "./pages/AskPage";
import { LedgerPage } from "./pages/LedgerPage";
import { SeasonPage } from "./pages/SeasonPage";
import { NotFoundPage } from "./pages/NotFoundPage";

export default function App() {
  const { health, modelReady } = useHealth();
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const ctx = useMemo<AppContextValue>(
    () => ({
      health,
      modelReady,
      openDetail: (id: number) => setSelectedId(id),
    }),
    [health, modelReady],
  );

  return (
    <ModelsProvider>
      <AppContext.Provider value={ctx}>
        <div className="relative z-[2] flex min-h-screen flex-col">
          <Navbar />

          <main className="shell flex-1 pb-24 pt-10 sm:pt-14">
            <Routes>
              <Route path="/" element={<NewSightingPage />} />
              <Route path="/sightings" element={<SightingsPage />} />
              <Route path="/ask" element={<AskPage />} />
              <Route path="/ledger" element={<LedgerPage />} />
              <Route path="/season" element={<SeasonPage />} />
              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </main>

          <footer className="shell border-t border-rule py-8">
            <p className="font-mono text-[0.68rem] uppercase tracking-[0.1em] text-muted">
              Bioledger · local field journal · runs on Ollama or in your browser
            </p>
          </footer>

          <DetailDialog id={selectedId} onClose={() => setSelectedId(null)} />
        </div>
      </AppContext.Provider>
    </ModelsProvider>
  );
}
