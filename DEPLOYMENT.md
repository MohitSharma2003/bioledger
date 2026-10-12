# Deploying Bioledger without Docker

Bioledger is a FastAPI backend that also serves a React single-page app from
`web/static`. There is a Dockerfile and a docker-compose file in the repo, but
neither is required. This guide deploys with platform-native runtimes only.

Read the whole "What is not deployed" section before you publish anything.

## What is not deployed

- **No AI model is deployed to the cloud.** `OLLAMA_HOST` always points at the
  machine itself (`http://127.0.0.1:11434`). On a public box there is no Ollama,
  so the API reports it as offline and the write endpoints save observations
  without an AI note. AI on the deployed site comes from the optional
  browser-local model (Gemma 4 E2B, Transformers.js on WebGPU), which downloads
  from Hugging Face into the visitor's browser, never onto your server.
- **The Ollama address is never advertised while it is down.** The `/api/models`
  endpoint returns `endpoint: null` for Ollama unless the server can actually
  reach it, so a public deploy cannot be probed for an internal host.
- **Secret management.** Never commit `.env`. On the platform, put values in the
  dashboard (or the platform's secret store). `DATABASE_URL` is secret;
  `OLLAMA_HOST`, `BIOLEDGER_*` values are not.

## The two shapes that work

### A. Single Render web service (recommended)

FastAPI serves the UI, the PWA files, and every `/api` call on one origin. No
CORS, no proxy rewrites, the service-worker scope is root, and photo URLs stay
relative. This is the simplest correct path. `render.yaml` at the repo root
describes it, and the dashboard steps below reproduce it click by click.

### B. Vercel frontend + Render backend (split)

Only choose this if you really want the frontend on Vercel. The API still lives
on Render (it is a Python service; Vercel cannot host it). The repo-level
`vercel.json` proxies `/api/*` to the Render backend server-side, so the browser
never makes a cross-origin call and CORS is not needed. The split requires a
frontend build with base `/` (the default build uses `/static/`), the PWA icons
are served from the Vercel root, and one hard-coded `/static/...` reference (the
iOS apple-touch-icon) will 404 there. For those reasons A is simpler.

---

## Prerequisites

- The repo is pushed to GitHub (branch `main`).
- Node 22 and Python 3.12+ locally, to build and test before you deploy.
- Fresh build committed. Render's native Python runtime has no Node, so the UI
  must arrive built: run `npm run build` in `web/` and commit the resulting
  `web/static` before pushing for option A.

## Option A: single Render web service

### 1. Build and test locally first

From the repo root:

```powershell
python -m pip install -r requirements.txt
python -m pytest
cd web
npm install
npm run build
npm run check:pwa
npm test
```

`check:pwa` must report 5/5 PASS. Commit the built `web/static` if it changed.

### 2. Create the service (dashboard, no Docker)

1. Cloud Console: **New -> Web Service**.
2. **Connect repository** -> pick `bioledger`, branch `main`.
3. **Name**: `bioledger`
4. **Region / Instance Type**: your call. Read the persistence note below.
5. **Root Directory**: leave empty (repo root).
6. **Build Command**:
   ```
   pip install -r requirements.txt
   ```
7. **Start Command**:
   ```
   uvicorn main:app --host 0.0.0.0 --port $PORT
   ```
8. **Health Check Path**: `/api/health`
9. Add the **Env Vars** table below.
10. **Create Web Service**, then wait for the first deploy.

### 3. Env Vars (Render, option A)

| Key | Value | Why |
| --- | --- | --- |
| `OLLAMA_HOST` | `http://127.0.0.1:11434` | Local only. Never point this at a public host. |
| `BIOLEDGER_MODEL` | `gemma3:4b` | Desktop default model name. |
| `BIOLEDGER_EMBED_MODEL` | `nomic-embed-text` | Embedding model name. |
| `BIOLEDGER_VISION_MODEL` | `gemma3:4b` | Vision model name. |
| `BIOLEDGER_TIMEOUT` | `10` | Fail fast when Ollama is absent instead of hanging. |
| `BIOLEDGER_DB` | `/var/data/bioledger.db` | SQLite file on the persistent disk mount. |
| `BIOLEDGER_PHOTO_DIR` | `/var/data/photos` | Photos on the persistent disk mount. |

Do not set `BIOLEDGER_CORS_ORIGINS` or `BIOLEDGER_PUBLIC_BASE` for option A;
the single origin needs neither.

### 4. Persistence (honest version)

Render **Free and Starter** plans have an **ephemeral filesystem**: the app runs
fine, but every restart or redeploy resets the SQLite database and any uploaded
photos. Offline browser data (the IndexedDB outbox and photo cache) survives in
the visitor's browser regardless.

To make server-side data durable, use a **paid** instance type and attach a
persistent disk:

1. In the service, **Instance -> Disks -> Add Disk**.
2. **Name**: `bioledger-data`, **Mount Point**: `/var/data`, **Size**: `1`.
3. Restart the service. The env vars above already point into the mount.

The app creates `/var/data` at startup if it is missing, so nothing breaks when
no disk is attached; the data just does not survive restarts there.

## Option B: Vercel frontend + Render backend (split)

Skip this unless you need Vercel specifically. It needs option A's backend plus:

1. Create the Render web service as in option A, name it `bioledger-api`.
2. In `vercel.json`, replace `https://bioledger-api.onrender.com` with your real
   Render URL (keep `/api/:path*`). This is the only manual edit; it is a proxy
   from the Vercel domain to the API, so the browser stays same-origin.
3. Vercel: **Add New Project** -> import the same repo.
4. **Framework Preset**: `Other` (do not use the Vite preset; it would use the
   wrong base).
5. **Root Directory**: `/`
6. **Install Command**:
   ```
   npm --prefix web ci
   ```
7. **Build Command**:
   ```
   npm --prefix web run build -- --base=/
   ```
   This rebuilds the app so assets sit at `/assets`, `/icons`, `/manifest.webmanifest`,
   `/sw.js` on the Vercel origin.
8. **Output Directory**: `static`
9. **Deploy**. Vercel serves the built files first, then applies the `vercel.json`
   rewrites: `/api/*` goes to Render, everything else falls back to `/index.html`.

Caveats for B: `npm run build` with `--base=/` overwrites the repo copy of
`web/static` during the Vercel build only (it runs on Vercel's machines, not
yours), the iOS apple-touch-icon under `/static/...` 404s, and service-worker
precache entries that reference `/static/...` are skipped silently so the app
shell is cached but some icons are not. None of that blocks install or offline
use, and none of it exists in option A.

## Verification after deploy

- `GET /api/health` returns 200 with `"ollama": false` (expected on a public box).
- `GET /` returns the app shell; `GET /manifest.webmanifest` and `GET /sw.js`
  return 200 with the correct media types.
- Record an observation with no photo and confirm it persists across a restart
  (paid plan with disk) or note the reset (free plan).
- Visit the site over HTTPS in Chrome on a phone: Add to Home Screen, open it
  offline, and it loads. The browser model downloads on demand (a few gigabytes,
  WebGPU required) if you want on-device AI.
- Check the endpoints list for any expected internal value: run `/api/models`
  and confirm `ollama.endpoint` is `null` while Ollama is offline.

## Postgres instead of a disk (optional)

If you prefer a managed database over disk storage, the app accepts
`DATABASE_URL` and falls back to SQLite if Postgres is unreachable. Render's
managed Postgres with the `pgvector` extension works with `db/`; the app needs
`psycopg[binary]` and `pgvector` installed (add them to `requirements.txt` or
install on the box). The MCP extras are only needed if you will publish the MCP
server.

## Dockerfiles

The `Dockerfile` and `docker-compose.yml` remain in the repo as an optional,
purely local path. They are not part of the platform deployment and no Docker
install is required for any of the steps above.