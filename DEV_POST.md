---
title: "Bioledger: a nature notebook that runs on my laptop, not someone's cloud"
published: false
description: "I built an offline naturalist field notebook on an open-weight model: spend ten minutes outside, and a local Gemma writes the field note. Hacktoberfest 2026 Week 1: Touch Grass."
tags: devchallenge, hf26challenge, ai, opensource
cover_image: # paste your screenshot/GIF URL here before publishing
---

<!--
BEFORE YOU PUBLISH (2 things only):
1. Replace every [[...]] marker with your real repo URL / screenshot / session link.
2. Read it out loud and change any sentence that doesn't sound like you.
Everything else is already accurate to the code in the repo.
-->

# Bioledger: a nature notebook that runs on my laptop, not someone's cloud

I'm interning full-time, and by the time the evening comes I've been staring at a screen
for twelve hours. Every "get outside" app I tried did the same trick: it moved the screen
from my desk to my pocket and called that fresh air. For Hacktoberfest Week 1, I wanted to
build the opposite — a tool whose entire point is to be **closed again as fast as possible.**

The theme is **Touch Grass**: use open-source AI to get people off the screen and into the
world. So I built **Bioledger**. You spend ten minutes outside. You come back, describe what
you noticed — or drop in one photo — and a model running **on your own laptop** turns it into
a real field note.

## What I Built

Bioledger is an offline, open-weight naturalist field notebook. It's for anyone who walks the
same park or street every day and slowly wants to know it better — without that knowledge
living on someone else's server.

You type one sentence — what you saw — and optionally attach a photo:

> "A copper dragonfly kept landing on the same reed by the pond."

A few seconds later you get a tidy field note:

- a best-guess **name** (and it's honest when it doesn't know),
- a **category** (plant, bird, insect, fungus, cloud…),
- a one-line note in your voice, plus a few **tags**,
- a **season note** ("darters are typical of warm months near still water"),
- **similar sightings** from your own past logs,

and a **ledger** that tracks sightings, species, a day-streak, and what's in season right now.

## Why a tracker wasn't enough

Most "touch grass" projects are wellness or screen-time trackers, and the screen is still the
main character. Bioledger makes the time outside *produce something durable*: a growing,
personal, scientific record of what lives near you. Going outside stops being a chore you
tick off and becomes data you actually want to keep.

## Demo

![Bioledger: logging a sighting and seeing it become a field note](docs/demo.gif)

[[ Replace with your GIF or 2–3 screenshots. Save them into a `docs/` folder in the repo and
reference them here. This is the single most important thing you can add. ]]

Run it yourself in about a minute:

```bash
ollama pull gemma3:4b
ollama pull nomic-embed-text
git clone [[YOUR REPO URL]]
cd bioledger
pip install -r requirements.txt
uvicorn main:app --reload
```

Open <http://localhost:8000> and log what you saw outside today. If Ollama is off, the app
still runs — it just can't write new notes until it's back.

## Code

[[ Embed your GitHub repo directly here — on DEV, paste the repo URL on its own line and it
renders as a card. Example: https://github.com/YOUR_USERNAME/bioledger ]]

Source: [[YOUR GITHUB REPO URL]] · License: MIT

## How I Built It

The whole app is built around open-source AI, top to bottom — no closed API anywhere in the
loop:

```
Browser UI ──▶ FastAPI ──▶ local Gemma (Ollama) ──▶ structured sighting + note
                   │                 │
                   │                 └──▶ nomic-embed-text ──▶ embedding
                   │
                   └──▶ store ──┬── SQLite (default, fully offline)
                                └── TimescaleDB + pgvector (scalable twin)
                                       • hypertable of sightings
                                       • continuous aggregate = "in season"
                                       • pgvector = "find similar sightings"
```

- **Open-weight model** (`gemma3:4b`) via **Ollama** writes each field note and answers
  questions in plain language ("what did I see near water in spring?").
- **Local embeddings** (`nomic-embed-text`) power "find similar sightings" — nearest-neighbour
  search over my own notes, with no internet.
- **A real hybrid store.** By default it's a single SQLite file, so it's truly offline with
  zero setup. Point `DATABASE_URL` at Postgres and the *same code* writes to a
  **hypertable**, keeps a **continuous aggregate** for "what's in season," and uses
  **pgvector** for vector search. I did both on purpose: it has to work offline on a laptop,
  but it should also be able to scale to a shared, neighbourhood-scale dataset later.
- **An MCP server.** I exposed my own journal as tools (`ledger_query`, `in_season`,
  `similar_sightings`, `journal_stats`) so any AI agent can reason over the ledger. I built
  it to run against **Tiger Data / Tiger Cloud** for the Postgres side.

Two bits I'm proud of:

- It's genuinely **private by default** — the model and the database are both local, so the
  sensitive part of a naturalist's log (*where* and *what*) never leaves the machine.
- It **degrades gracefully**: photo reading on-device with `gemma3:4b`, or swap in the tiny
  `moondream` vision model with one env var (`BIOLEDGER_VISION_MODEL=moondream`).

## Why Does Open Innovation Matter?

The challenge asks where an open approach worked *better* than a closed one. For Bioledger
it's not a slogan — it's the reason the app can exist at all:

| Decision | Open approach (what I did) | Closed alternative | Why open won here |
| --- | --- | --- | --- |
| The model | Open-weight **Gemma 3** (`gemma3:4b`) via **Ollama**, on my laptop | A hosted vision/chat API | Works **offline**, **$0 per note**, no card on file |
| My data | Locations + sightings stay in a local database on my disk | Prompts and photos logged on a server I don't control | The private thing a naturalist keeps never leaves the machine |
| Model choice | Swap with one env var (`BIOLEDGER_MODEL`) | Locked to one vendor's endpoint | The same app runs a 4B model or a bigger one |
| Embeddings | Local `nomic-embed-text` | A cloud embedding API | "Find similar sightings" works with no internet |

A closed pipeline forces a trade: either you pay per call and upload your location history,
or you don't ship the feature. Open weights let one person build a private, offline tool for
free — and it stays *theirs* to audit, swap, or fork. That's the point of open innovation:
the capability doesn't depend on one vendor staying online, affordable, or interested.

## What Surprised Me

- **A 4B model is genuinely enough.** The task is well-scoped (read one messy sentence → one
  structured record), so a small open model does it well and fast on a laptop.
- **I had to force honesty.** Early on the model kept inventing Latin species names with total
  confidence. I tightened the prompt to prefer plain names and to say when it's unsure — now
  it says "copper dragonfly" instead of fabricating *something*-us. Honest uncertainty turned
  out to matter more than apparent precision.
- **On-device vision felt different.** Reading a photo without uploading it changes how you
  feel about logging a spot you'd rather not broadcast.
- **The vector search surprised me most.** "Find similar sightings" resurfaced things I'd
  forgotten I'd logged weeks ago — the ledger quietly became more useful than the sum of its
  entries.

## My Agent Session

[[ Optional but judges like it: save your build session with DevRelay and embed it here with
the `agent_session` tag, or link to it. Delete this section if you skip it. ]]

## Prize Categories

I'm entering **Best Use of Gemma** — Bioledger runs Google's open-weight Gemma locally for
both text and vision — and the **Tiger Data** category, since the scalable store is a real
TimescaleDB hypertable + continuous aggregate + pgvector setup, queried by agents over MCP.

## What's Next

Three ideas I'd actually build on top of this:

- a weekly **"what changed near me"** digest assembled from the continuous aggregate,
- an opt-in **shared neighbourhood dataset** so you can see what everyone logged this week,
- **fine-tuning a tiny local model** on my own sightings so the notes sound more like me.

---

*Built for the [Hacktoberfest 2026 Open-Source AI Challenge — Week 1: Touch Grass](https://dev.to/challenges/hacktoberfest-week1-2026-10-05).
It runs on my own laptop, on an open-weight model, with no cloud. 🌿*
