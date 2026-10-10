import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "./ui/dialog";
import { Specimen } from "./Specimen";
import { api } from "../lib/api";
import type { Observation } from "../lib/types";

export function DetailDialog({
  id,
  onClose,
}: {
  id: number | null;
  onClose: () => void;
}) {
  const [observation, setObservation] = useState<Observation | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (id == null) {
      setObservation(null);
      return;
    }
    let alive = true;
    setLoading(true);
    setError(null);
    api
      .observation(id)
      .then((o) => alive && setObservation(o))
      .catch((e) => alive && setError(e instanceof Error ? e.message : "Not found"))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [id]);

  return (
    <Dialog open={id != null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent aria-describedby={undefined}>
        <DialogTitle className="sr-only">
          {observation?.species ?? "Sighting"}
        </DialogTitle>
        {loading ? (
          <div className="grid place-items-center py-20 text-muted">
            <Loader2 size={22} className="animate-spin" />
          </div>
        ) : error ? (
          <p className="py-10 text-center text-alert">{error}</p>
        ) : observation ? (
          <Specimen observation={observation} />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
