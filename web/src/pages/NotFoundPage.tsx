import { Link } from "react-router-dom";
import { buttonVariants } from "../components/ui/button";
import { cn } from "../lib/utils";

export function NotFoundPage() {
  return (
    <section className="max-w-xl py-16">
      <p className="eyebrow mb-3">404</p>
      <h1 className="display-title text-page-title">That page is not here.</h1>
      <p className="mt-4 text-lead text-muted">
        The address you opened does not match any page in the journal.
      </p>
      <div className="mt-8">
        <Link to="/" className={cn(buttonVariants({ size: "lg" }))}>
          Back to new sighting
        </Link>
      </div>
    </section>
  );
}
