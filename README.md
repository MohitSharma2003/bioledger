# Bioledger

**An offline, open-weight naturalist field notebook.**

Spend ten minutes outside. Come back and describe what you noticed — or drop in a photo.
A local open-weight model turns it into a structured sighting, remembers it, and slowly
grows a personal biodiversity ledger you can question in plain language.

No cloud. No API key. Your notes never leave your machine.

Built for the **Hacktoberfest 2026 Open-Source AI Challenge — Week 1: Touch Grass.**

---

## Why it is different

Most "touch grass" projects are wellness or screen-time trackers. Bioledger makes going
outside **produce something durable**: a scientific record of your own patch of the world.
The screen is the shortest part of the loop — you observe outside, then log once.

And because the model runs locally on open weights, the private thing a naturalist keeps —
*where* you were and *what you saw* — stays on your disk.

## How it works

```
Browser UI ──▶ FastAPI ──▶ local Gemma (Ollama)  ──▶ structured sighting + note
                   │                 │
                   │                 └──▶ nomic-embed-text  ──▶ embedding
                   │
                   └──▶ store ──┬── SQLite (default, fully offline)
                                └── TimescaleDB + pgvector (scalable twin)
                                       • hypertable of sightings
                                       • continuous aggregate = "in season"
                                       • pgvector = "find similar sightings"
```

- **Open-weight model** (default `gemma3:4b`) writes each field note and answers questions.
- **Local embeddings** (`nomic-embed-text`) power "find similar sightings".
- **Two interchangeable stores:** a zero-setup SQLite file, or TimescaleDB + pgvector for
  real time-series and vector search. Same code, chosen by `DATABASE_URL`.
- **MCP server** lets any AI agent query your ledger.

## Quickstart (zero-setup, fully offline)

```bash
# 1. Get the models (once)
ollama pull gemma3:4b
ollama pull nomic-embed-text

# 2. Install and run
pip install -r requirements.txt
uvicorn main:app --reload
```

Open <http://localhost:8000>, type what you saw outside, and log it.

Everything runs against your local Ollama. If Ollama is off, the app still runs — it
just cannot write new notes until it is back.

## Optional: load a photo

`gemma3:4b` is multimodal, so you can attach a photo and the model reads it on-device.
Prefer a tiny dedicated vision model? Pull `moondream` and set
`BIOLEDGER_VISION_MODEL=moondream`.

Photos are previewed before you submit, can be removed or replaced, and are validated for
type and size (10 MB by default) before upload.

## Using the journal

- **Structured field notes.** Every submission is turned into a specimen record: suggested
  subject, category, confidence, tags, the model's interpretation, date, and locality.
- **Honest uncertainty.** When confidence is low or no species could be named, the record
  says so plainly instead of inventing a name.
- **Search and filter.** Search the whole ledger by species, note, place, or tag, and filter
  by category. Open any entry to read its full record.
- **Never lose a note.** The raw observation is written to the database *before* the model
  is called. If Ollama is unavailable, the sighting is still saved and the UI explains what
  happened rather than silently dropping it.
- **Offline-first status.** The masthead shows the true model/backend state, and previously
  saved sightings stay readable and searchable with the model switched off.

## The scalable path: TimescaleDB + pgvector (Tiger Cloud)

Set a Postgres connection string and Bioledger switches stores automatically:

```bash
export DATABASE_URL="postgres://user:pass@host:port/db?sslmode=require"
```

On startup it applies [`db/schema.sql`](db/schema.sql), which creates:

- a **hypertable** keyed on time (every sighting is a time-series point),
- a **continuous aggregate** (`obs_weekly`) that keeps "what is in season" fresh, and
- a **pgvector** column + HNSW index for nearest-neighbour sighting search.

To run the same thing locally, `docker compose up` (requires Docker).

## MCP server

```bash
pip install mcp
python mcp_server.py
```

Exposes tools (`ledger_query`, `in_season`, `similar_sightings`, `journal_stats`) over
stdio so an agent can reason over your journal.

## Configuration

| Variable | Default | Meaning |
| --- | --- | --- |
| `OLLAMA_HOST` | `http://127.0.0.1:11434` | Where Ollama is listening |
| `BIOLEDGER_MODEL` | `gemma3:4b` | Main open-weight model |
| `BIOLEDGER_EMBED_MODEL` | `nomic-embed-text` | Embedding model |
| `BIOLEDGER_VISION_MODEL` | `gemma3:4b` | Model used when a photo is attached |
| `BIOLEDGER_DB` | `./bioledger.db` | SQLite file (default store) |
| `DATABASE_URL` | *(unset)* | Postgres/Tiger Cloud URL (overrides SQLite) |
| `BIOLEDGER_TIMEOUT` | `180` | Per-request Ollama timeout (seconds) |

## Project layout

```
config.py        settings + env vars
llm.py           Ollama client: parse, embed, vision, answer
store.py         SQLite store + TimescaleDB/pgvector store
schemas.py       request/response models
seed.py          demo sightings
main.py          FastAPI app and routes
mcp_server.py    MCP stdio server
db/schema.sql    hypertable + continuous aggregate + pgvector
web/             React + Vite + Tailwind source for the UI
static/          built UI (served by FastAPI; regenerate with `npm run build`)
```

## Front-end

The interface is a small React app (Vite + Tailwind, shadcn-style primitives over Radix).
It is built into `static/` and served by FastAPI, so the runtime is still one process and
one port.

```bash
cd web
npm install
npm run build     # writes to ../static
# or, for live development against the API:
npm run dev       # http://127.0.0.1:5173 (proxies /api to :8001)
```

## Why open innovation matters here

- **Runs offline on a laptop.** A 4B open-weight model is enough for a well-scoped task,
  so the whole app works with no internet and no per-call cost.
- **Private by default.** A naturalist's locations and sightings are sensitive; keeping
  the model and the database local means they are never uploaded.
- **Yours to change.** Swap the model with one env var, audit the prompt, fork the schema.
  Nothing depends on one vendor's API staying online or cheap.

## Development timeline

Bioledger was started and completed entirely within the Hacktoberfest 2026 Open-Source AI
Challenge — Week 1 window (Oct 5–11, 2026). All commits in this repository fall inside that
period; no work on this project predates the challenge.

## License

MIT — see [LICENSE](LICENSE).
