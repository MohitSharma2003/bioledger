# Global Hack Week: Hacktoberfest — how Bioledger claims the challenges

GHW runs **Oct 9–15, 2026**. Challenges are optional; each earns points, and points +
attendance build toward swag. Submit each challenge from its page on
<https://ghw.mlh.com/challenges>. This document maps **Bioledger** to the challenges it
genuinely satisfies so one project ticks many boxes.

> Reminder: GHW earns **points + swag**, not cash. The cash is on the DEV challenge — see
> `PUBLISHING.md`.

## Quick wins (do these first, no code)

- [ ] **Register & check in to Hacktoberfest** — https://hacktoberfest.com/my
- [ ] **Sign up for a Cursor Pro account** — build credits for the project
- [ ] **Sign up for the GitHub Student Developer Pack** (if eligible)
- [ ] **Fill out the MLH address form** — swag eligibility
- [ ] **Install and run the app once** so you can screenshot it for submissions

## Build-tool challenges

- [ ] **Getting Started with Copilot / Code with Codespaces / Intro to Repository Management**
      — use these while finishing the repo, then submit.
- [ ] **Use GitHub Copilot to Build a Simple Application**
      — push the repo to GitHub with Copilot/Codespaces help.
- [ ] **Use GitHub Copilot to complete any of this week's challenges** — meta-challenge.

## Tiger Data / Tiger Cloud (the big one — 6 challenges)

Bioledger ships a real Timescale/pgvector schema in `db/schema.sql`. Do these against a
**Tiger Cloud** service (free tier):

1. Sign up at Tiger Cloud, create a service, copy the connection string.
2. Put it in `.env` as `DATABASE_URL=postgres://...`.
3. Restart Bioledger — it applies `db/schema.sql` automatically.
4. Log a few sightings so there is data to look at.

Then submit each challenge:

- [ ] **Set up a Tiger Cloud service and create your first Hypertable**
      → `db/schema.sql` runs `create_hypertable('observations','created_at')`.
- [ ] **Accelerate Dashboards with Continuous Aggregates**
      → `obs_weekly` continuous aggregate (sightings per species per week).
- [ ] **Implement AI-Powered Vector Search with pgvector**
      → `embedding vector(768)` + HNSW index; "find similar sightings" uses `<=>`.
- [ ] **Integrate Tiger Cloud with your AI Agent with the Tiger CLI and MCP**
      → run `python mcp_server.py` and connect it via the Tiger CLI / MCP config so the agent
      can query the ledger.
- [ ] **Simulate an IoT sensor dataset for testing** *(optional)*
      → reuse the `observations` table shape to log synthetic field-sensor readings.
- [ ] **Ingest real-time financial data** *(optional, not core to Bioledger)*
      → only attempt if you want the extra point; it's off-theme.

## Notes

- The two optional Tiger challenges are not natural fits for a nature app — do them only if
  you want the extra points, and keep them clearly separate from the Bioledger story.
- Check the official challenge pages for exact submission requirements (some need a link, some
  a screenshot, some a short write-up). Don't skip the submission step — completing the work
  without submitting earns nothing.
