# The optional scalable store: TimescaleDB + pgvector (Tiger Cloud)

Bioledger's default store is a single local SQLite file. That is what the app uses out of
the box, fully offline, with zero setup. This document covers the **optional** Postgres
path: TimescaleDB (a hypertable + a continuous aggregate) with pgvector for
nearest-neighbour sighting search.

## Status: written but not exercised on the author's machine

Be plain about this: the SQLite path is verified end to end, and it is what backs the live
app and every test in `tests/`. The Postgres path is implemented (`store.PostgresStore`,
`db/schema.sql`, `docker-compose.yml`) and is what the Tiger Data category is built on, but
it has **not** been run on the author's laptop, because Docker is not installed there. Do
not claim it works until the steps below have actually produced a row.

## How it is wired in

Nothing is replaced. The same `store` interface is used either way; only the backend
changes, chosen at startup by `DATABASE_URL`:

```
config.DATABASE_URL set and reachable  ──▶ PostgresStore  (db/schema.sql applied on startup)
otherwise                              ──▶ SQLiteStore    (./bioledger.db)
```

If `DATABASE_URL` is set but the server cannot be reached or `db/schema.sql` fails,
`store.get_store()` falls back to SQLite rather than crashing the app. That behaviour is
covered by `tests/test_store_selection.py`.

## Schema

`db/schema.sql` creates:

- an `observations` table whose primary key is time-oriented (`created_at TIMESTAMPTZ`),
  plus the same optional photo columns the SQLite store uses (`photo_path`, `photo_mime`,
  `photo_bytes`),
- a **hypertable** over `created_at` (every sighting is a point in time),
- a **continuous aggregate** `obs_weekly` for "what is in season" (species counts and mean
  confidence per 7-day bucket, refreshed on a policy), and
- a **pgvector** `embedding vector(768)` column with an HNSW cosine index for
  "find similar sightings".

## Run it locally (requires Docker)

```bash
docker compose up
```

This starts a `timescale/timescaledb-ha:pg16` service. `db/schema.sql` is mounted as the
container's init script, so the hypertable, aggregate, and vector index are created on first
boot. The app container then talks to it via
`DATABASE_URL=postgres://postgres:bioledger@db:5432/bioledger`.

To point a local (non-Docker) app at any Postgres, including a Tiger Cloud service:

```bash
pip install "psycopg[binary]" pgvector
export DATABASE_URL="postgres://user:pass@host:port/db?sslmode=require"
uvicorn main:app --reload
```

On startup the schema is applied and the store switches over. Verify with, for example,
`GET /api/health` (the `backend` field reads `postgres`) and a new sighting in
`GET /api/observations`.

## Tiger Cloud / MCP

The MCP server (`mcp_server.py`) exposes the journal as tools (`ledger_query`, `in_season`,
`similar_sightings`, `journal_stats`). Run it against the Postgres/Tiger Cloud instance so an
agent can reason over the same time-series + vector data:

```bash
pip install mcp
python mcp_server.py
```

## Checklist before claiming this works

- [ ] `docker compose up` (or a Tiger Cloud service) reaches a healthy database.
- [ ] Startup applies `db/schema.sql` without error.
- [ ] `GET /api/health` reports `backend: postgres`.
- [ ] A new sighting appears in `observations` and in `GET /api/observations`.
- [ ] `SELECT * FROM obs_weekly;` returns a row after the refresh policy runs.
- [ ] `find_similar` returns neighbours (pgvector HNSW index used).
