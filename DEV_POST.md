---
title: "Bioledger: a nature notebook that runs on my laptop, not someone's cloud"
published: false
description: "I built an offline naturalist field notebook on an open-weight model: spend ten minutes outside, and a local Gemma writes the field note. Hacktoberfest 2026 Week 1: Touch Grass."
tags: hacktoberfest, ai, opensource, python
cover_image:  # add your screenshot/GIF URL here before publishing
---

> **How to use this draft:** This is a scaffold in your voice. Before you publish, rewrite every
> `[[...]]` block with your real experience, add 2–3 of your own screenshots/GIFs, and cut anything
> that doesn't sound like you. Judges weight writing quality most, and **they can tell when a post
> isn't authentic.** The code is done — this part is yours.
>
> **What judges score (this draft is organised to hit all five):**
> 1. **Writing Quality** — *weighted most heavily.* First person, specific, readable.
> 2. **Relevance to Prompt & Theme** — open-source AI is the core (see "Why open beats closed")
>    and it fits *Touch Grass* (see the opening + "Why a tracker wasn't enough").
> 3. **Creativity** — it makes going outside *produce a durable scientific record*.
> 4. **Technical Execution** — working app + architecture, agent/tooling, hybrid store.
> 5. **Partner technology** — runs on **Gemma** (featured category) + **Tiger Data** (Postgres).

# Bioledger: a nature notebook that runs on my laptop, not someone's cloud

[[Open with your real situation in 2–3 sentences. Example: "I'm interning full-time, and by evening
I've been staring at a screen for twelve hours. Every 'get outside' app I tried just moved the screen
from one place to another. So for Hacktoberfest Week 1, I built the opposite: a notebook whose whole
point is to be closed again as fast as possible."]]

The theme is **Touch Grass** — build something with open-source AI that gets people off the screen
and into the world, where the screen is the shortest part of the experience.

So I built **Bioledger**. You spend ten minutes outside. You come back, describe what you noticed —
or drop in one photo — and a model running **on your own laptop** turns it into a real field note.

## Why a tracker wasn't enough

[[2–3 sentences. Make the point: most "touch grass" projects are wellness or screen-time trackers that
still live on the screen. Bioledger makes the time outside *produce something* — a growing, personal
record of what lives near you. Going outside becomes data you actually want to keep.]]

## What it does

You type one sentence — what you saw — and optionally attach a photo.

> "A copper dragonfly kept landing on the same reed by the pond."

A few seconds later you get a tidy field note:

- a best-guess **name** (and it is honest when it doesn't know),
- a **category** (plant, bird, insect, fungus, cloud…),
- a one-line note in your voice, and a few **tags**,
- a **season note** ("darters are typical of warm months near still water"),
- **similar sightings** from your own past logs,

and a **ledger** that tracks sightings, species, a day-streak, and what's in season right now.

[[Add a screenshot or a short GIF of a real sighting you logged. This is the single most important
thing you can add — people need to see it work.]]

## Why open beats closed (the required part)

The challenge asks where an open approach worked *better* than a closed one. Here it is concrete:

| Decision | Open approach (what I did) | Closed alternative | Why open won here |
| --- | --- | --- | --- |
| The model | Open-weight **Gemma 3** (`gemma3:4b`) via **Ollama**, on my laptop | A hosted vision/chat API | Works **offline**, **$0 per note**, no card on file |
| My data | Locations + sightings stay in a local database on my disk | Prompts and photos logged on a server I don't control | The private thing a naturalist keeps never leaves the machine |
| Model choice | Swap with one env var (`BIOLEDGER_MODEL`) | Locked to one vendor's endpoint | Same app runs a 4B model or a bigger one |
| Embeddings | Local `nomic-embed-text` | Cloud embedding API | "Find similar sightings" works with no internet |

That is the whole thesis: open pieces let one person build a private, offline tool for free — and
it stays *theirs* to audit or fork.

## How it works

[[Describe the architecture in your own words. The real design:]]

```
Browser UI ──▶ FastAPI ──▶ local Gemma (Ollama) ──▶ structured sighting
                   │
                   └──▶ store ──┬── SQLite (default, offline)
                                └── TimescaleDB + pgvector
                                       • hypertable of sightings
                                       • continuous aggregate = "in season"
                                       • pgvector = similar sightings
```

Two things I'm proud of:

- **A real hybrid store.** By default it's a single SQLite file — truly offline. Point
  `DATABASE_URL` at Postgres and the *same code* writes to a **hypertable**, keeps a
  **continuous aggregate** for "what's in season," and uses **pgvector** for nearest-neighbour
  search. [[Say why you did both: it must work offline on a laptop, but it should also scale.]]
- **An MCP server.** [[Explain: you exposed your own journal as tools so an AI agent can query it.
  Mention you built it on Tiger Data / Tiger Cloud.]]

## What surprised me

[[2–4 personal observations. Ideas:
- A 4B model is genuinely enough for this — the task is well-scoped.
- I had to *force honesty*: the model kept inventing Latin names, so I made the prompt prefer plain
  names and low confidence when unsure. Now it says "copper dragonfly" instead of fabricating a species.
- Reading the photo on-device *felt* different from uploading it — nothing left the laptop.
- The vector search surfaced sightings I'd forgotten I'd made.]]

## Try it yourself

```bash
ollama pull gemma3:4b
ollama pull nomic-embed-text
git clone [[YOUR REPO URL]]
cd bioledger
pip install -r requirements.txt
uvicorn main:app --reload
```

Open <http://localhost:8000> and log what you saw outside today.

Source: [[YOUR GITHUB REPO URL]] · License: MIT

## What's next

[[2–3 honest ideas: a weekly "what changed near me" digest; a shared dataset so you can see what the
whole neighbourhood logged this week; fine-tuning a tiny local model on your own sightings.]]

---

*Built for the [Hacktoberfest 2026 Open-Source AI Challenge — Week 1](https://dev.to/challenges).
It runs on my own laptop, on an open-weight model, with no cloud. 🌿*
