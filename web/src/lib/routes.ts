export interface NavRoute {
  path: string;
  label: string;
}

/** The five top-level pages, in the order they appear in the navigation. */
export const NAV_ROUTES: NavRoute[] = [
  { path: "/", label: "New Sighting" },
  { path: "/sightings", label: "My Sightings" },
  { path: "/ask", label: "Ask Journal" },
  { path: "/ledger", label: "My Ledger" },
  { path: "/season", label: "In Season" },
];
