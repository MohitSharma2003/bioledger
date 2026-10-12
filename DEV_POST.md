---
title: "Bioledger: a nature notebook that runs on my laptop, not someone's cloud"
published: false
description: "I built an offline naturalist field notebook on an open-weight model: spend ten minutes outside, and a local Gemma writes the field note. Hacktoberfest 2026 Week 1: Touch Grass."
tags: devchallenge, hf26challenge, ai, opensource
cover_image: https://raw.githubusercontent.com/MohitSharma2003/bioledger/main/docs/01-record-a-sighting.png
---

<!--
BEFORE YOU PUBLISH:
1. Push the repo and the docs/ screenshots to GitHub (main branch); the image URLs above
   point at raw.githubusercontent.com/MohitSharma2003/bioledger/main/docs/... and will only
   render once those files are pushed.
2. Read it out loud and change any sentence that doesn't sound like you.
Everything else is already accurate to the code in the repo.
-->

# Bioledger: a nature notebook that runs on my laptop, not someone's cloud

I'm interning full-time, and by the time the evening comes I've been staring at a screen
for twelve hours. Every "get outside" app I tried did the same trick: it moved the screen
from my desk to my pocket and called that fresh air. For Hacktoberfest Week 1, I wanted to
build the opposite, a tool whose entire point is to be **closed again as fast as possible.**

The theme is **Touch Grass**: use open-source AI to get people off the screen and into the
world. So I built **Bioledger**. You spend ten minutes outside. You come back, describe what
you noticed, or drop in one photo, and a model running **on your own laptop** turns it into
a real field note.

## What I Built

Bioledger is an offline, open-weight naturalist field notebook. It's for anyone who walks the
same park or street every day and slowly wants to know it better, without that knowledge
living on someone else's server.

You type one sentence about what you saw, and optionally attach a photo:

> "A copper dragonfly kept landing on the same reed by the pond."

A few seconds later you get a tidy field note:

- a best-guess **name** (and it's honest when it doesn't know),
- a **category** (plant, bird, insect, fungus, cloud...),
- a one-line note in your voice, plus a few **tags**,
- a **season note** ("darters are typical of warm months near still water"),
- **similar sightings** from your own past logs,

and a **ledger** that tracks sightings, species, a day-streak, and what's in season right now.

It's also installable. The same site is a Progressive Web App, so it can be pinned to a home
screen or installed on a desktop and opened like a native app, and it keeps working offline.
By default the model is **Gemma3:4B** running locally through Ollama; an optional **Gemma 4
E2B** model can run entirely inside the browser on WebGPU, downloaded once and then kept in
local storage. Either way, nothing you log leaves the device.

## Why a tracker wasn't enough

Most "touch grass" projects are wellness or screen-time trackers, and the screen is still the
main character. Bioledger makes the time outside *produce something durable*: a growing,
personal, scientific record of what lives near you. Going outside stops being a chore you
tick off and becomes data you actually want to keep.

## Demo

![Bioledger: recording a sighting](https://raw.githubusercontent.com/MohitSharma2003/bioledger/main/docs/01-record-a-sighting.png)

![Bioledger: the sightings ledger](https://raw.githubusercontent.com/MohitSharma2003/bioledger/main/docs/02-sightings.png)

![Bioledger: the ledger overview](https://raw.githubusercontent.com/MohitSharma2003/bioledger/main/docs/03-ledger.png)

Run it yourself in about a minute:

```bash
ollama pull gemma3:4b
ollama pull nomic-embed-text
git clone https://github.com/MohitSharma2003/bioledger
cd bioledger
pip install -r requirements.txt
uvicorn main:app --reload
```

Open <http://localhost:8000> and log what you saw outside today. If Ollama is off, the app
still runs; it just can't write new notes until it's back.

## Code

https://github.com/MohitSharma2003/bioledger

Source: https://github.com/MohitSharma2003/bioledger · License: MIT

## How I Built It

The whole app is built around open-source AI, top to bottom, with no closed API anywhere in the
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

- **Default model: Gemma3:4B** (`gemma3:4b`, Apache-2.0), through **Ollama**. It writes each
  field note, reads photos, and answers questions in plain language ("what did I see near
  water in spring?").
- **Optional mobile model: Gemma 4 E2B (for mobile)**, running **entirely in a browser on
  WebGPU** (Transformers.js). It is a separate runtime: the weights download once after you
  select it and say yes, are cached offline, and it is never downloaded, initialized, or used
  automatically. It is not a fallback for the desktop model either.
- **Local embeddings** (`nomic-embed-text`) power "find similar sightings": nearest-neighbour
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

- It's genuinely **private by default**: the model and the database are both local, so the
  sensitive part of a naturalist's log (*where* and *what*) never leaves the machine.
- It **degrades gracefully**: photo reading on-device with `gemma3:4b`, or swap in the tiny
  `moondream` vision model with one env var (`BIOLEDGER_VISION_MODEL=moondream`). If the
  optional browser model can't run (no WebGPU), the desktop path is untouched and the UI
  says so instead of hiding it.

## Why Does Open Innovation Matter?

The challenge asks where an open approach worked *better* than a closed one. For Bioledger
it's not a slogan; it's the reason the app can exist at all:

| Decision | Open approach (what I did) | Closed alternative | Why open won here |
| --- | --- | --- | --- |
| The model | Open-weight **Gemma3:4B** (`gemma3:4b`) via **Ollama**, with an optional **Gemma 4 E2B** browser runtime | A hosted vision/chat API | Works **offline**, **$0 per note**, no card on file |
| My data | Locations + sightings stay in a local database on my disk | Prompts and photos logged on a server I don't control | The private thing a naturalist keeps never leaves the machine |
| Model choice | Swap with one env var (`BIOLEDGER_MODEL`), or run the optional model in-browser | Locked to one vendor's endpoint | The same app runs a 4B model on a laptop or in a phone browser |
| Embeddings | Local `nomic-embed-text` | A cloud embedding API | "Find similar sightings" works with no internet |

A closed pipeline forces a trade: either you pay per call and upload your location history,
or you don't ship the feature. Open weights let one person build a private, offline tool for
free, and it stays *theirs* to audit, swap, or fork. That's the point of open innovation:
the capability doesn't depend on one vendor staying online, affordable, or interested.

## What Surprised Me

- **A 4B model is genuinely enough.** The task is well-scoped (read one messy sentence → one
  structured record), so Gemma3:4B does it well and fast on a laptop. It was a surprise that a
  browser could run an even smaller Gemma 4 E2B locally on a phone.
- **I had to force honesty.** Early on the model kept inventing Latin species names with total
  confidence. I tightened the prompt to prefer plain names and to say when it's unsure; now
  it says "copper dragonfly" instead of fabricating *something*-us. Honest uncertainty turned
  out to matter more than apparent precision.
- **On-device vision felt different.** Reading a photo without uploading it changes how you
  feel about logging a spot you'd rather not broadcast.
- **The vector search surprised me most.** "Find similar sightings" resurfaced things I'd
  forgotten I'd logged weeks ago; the ledger quietly became more useful than the sum of its
  entries.

## Prize Categories

I'm entering **Best Use of Gemma**: Bioledger runs Google's open-weight Gemma locally for
both text and vision. The default is **Gemma3:4B** through Ollama on the desktop, and an
optional **Gemma 4 E2B (for mobile)** model runs entirely in-browser on WebGPU. I'm also
entering the **Tiger Data** category, since the scalable store is a real TimescaleDB
hypertable + continuous aggregate + pgvector setup, queried by agents over MCP.

## What's Next

Three ideas I'd actually build on top of this:

- a weekly **"what changed near me"** digest assembled from the continuous aggregate,
- an opt-in **shared neighbourhood dataset** so you can see what everyone logged this week,
- **fine-tuning a tiny local model** on my own sightings so the notes sound more like me.

---

*Built for the [Hacktoberfest 2026 Open-Source AI Challenge, Week 1: Touch Grass](https://dev.to/challenges/hacktoberfest-week1-2026-10-05).
It runs on my own laptop, on an open-weight model, with no cloud. 🌿*
