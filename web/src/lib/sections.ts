export interface NavSection {
  id: string;
  label: string;
}

export const SECTIONS: NavSection[] = [
  { id: "overview", label: "Overview" },
  { id: "new-sighting", label: "New Sighting" },
  { id: "ask", label: "Ask Journal" },
  { id: "ledger", label: "My Ledger" },
  { id: "season", label: "In Season" },
  { id: "sightings", label: "Sightings" },
];
