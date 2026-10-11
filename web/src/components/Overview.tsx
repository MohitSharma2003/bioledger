import { ArrowRight, Sprout } from "lucide-react";
import { Button } from "./ui/button";
import { AiBanner } from "./AiBanner";
import type { Health } from "../lib/types";

export function Overview({
  notice,
  health,
  modelReady,
  total,
  species,
}: {
  notice: string | null;
  health: Health | null;
  modelReady: boolean;
  total: number;
  species: number;
}) {
  return (
    <section id="overview" className="section-anchor pt-14 sm:pt-20">
      <div className="grid gap-10 lg:grid-cols-[1.55fr_1fr] lg:gap-16">
        <div>
          <p className="eyebrow mb-4 flex items-center gap-2">
            <Sprout size={14} /> Offline nature journal
          </p>
          <h1 className="display-title text-[2.9rem] leading-[1.02] sm:text-[4.5rem]">
            Write down what you
            <br />
            find outside.
          </h1>
          <p className="mt-6 max-w-xl font-serif text-[1.2rem] leading-relaxed text-forest/90 sm:text-[1.3rem]">
            Type a few words about a sighting and Bioledger turns it into a
            structured field note: species, confidence, tags, and what else is
            around. The model runs locally, so it keeps working with no internet.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button size="lg" onClick={() => scrollTo("new-sighting")}>
              Log a sighting <ArrowRight size={16} />
            </Button>
            <Button
              size="lg"
              variant="outline"
              onClick={() => scrollTo("ask")}
            >
              Ask the journal
            </Button>
          </div>
          <div className="mt-8">
            <AiBanner
              notice={notice}
              health={health}
              modelReady={modelReady}
            />
          </div>
        </div>

        <aside className="self-start rounded-sm border border-rule bg-paper-raised/70 p-6 shadow-specimen">
          <p className="field-label mb-4">The ledger so far</p>
          <div className="flex items-end gap-8">
            <div>
              <div className="font-serif text-5xl leading-none text-forest">
                {total}
              </div>
              <div className="mt-1 font-mono text-[0.68rem] uppercase tracking-[0.1em] text-muted">
                sightings
              </div>
            </div>
            <div>
              <div className="font-serif text-5xl leading-none text-moss">
                {species}
              </div>
              <div className="mt-1 font-mono text-[0.68rem] uppercase tracking-[0.1em] text-muted">
                species
              </div>
            </div>
          </div>
          <p className="mt-6 border-t border-rule pt-4 font-serif text-[0.95rem] italic leading-relaxed text-muted">
            Everything is stored in a local file on this computer. No account,
            no cloud.
          </p>
        </aside>
      </div>
    </section>
  );
}

function scrollTo(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
}
