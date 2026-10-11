# Publishing checklist: do these in order

Everything in `bioledger/` is built and tested end-to-end against the real local model.
The only things left are the ones that legally and practically must come from you: signing
into your own accounts and adding your own voice. Total hands-on time: **~30 minutes**.

---

## ⏰ Deadline (your timezone)

- **Week 1 "Touch Grass" submissions close: Oct 11, 2026, 11:59 PM PT** = **Oct 12, 2026 ~12:29 PM IST.**
- **Global Hack Week: Oct 9-15, 2026** (submit GHW challenges any time in that window).

---

## Step 1: Claim the easy stickers (10 min, on hacktoberfest.com)

1. Sign in at <https://hacktoberfest.com/my> with **MyMLH** → sticker: *Sign in*.
2. Add your **shipping address** → sticker: *Address*.
3. Connect your **DEV** account → sticker: *Connect DEV*.
4. Join the **MLH Community Discord** + install **DevRelay** → stickers.
5. Complete the pre-event survey; optionally connect DigitalOcean.

## Step 2: Register for the events

- Week 1 DEV Challenge: <https://dev.to/challenges/hacktoberfest-week1-2026-10-05> → **Sign Up**.
- Global Hack Week: <https://ghw.mlh.com> → register, complete registration challenges.

## Step 3: Push the project to GitHub

The repo is built and committed locally at `bioledger/`. Create an **empty** repo named
`bioledger` on GitHub, then:

```bash
cd "C:\Users\Ankit Sharma\Documents\Default Project\bioledger"
git remote add origin https://github.com/<YOUR_USERNAME>/bioledger.git
git branch -M main
git push -u origin main
```

Then replace every `[[YOUR REPO URL]]` in `DEV_POST.md` with the real URL.

## Step 4: Run it and capture proof (this is what wins)

> ✅ **Already done on this machine:** Ollama is installed, and `gemma3:4b`,
> `nomic-embed-text`, and `moondream` are pulled. The app was smoke-tested end-to-end
> against the real local model. You can jump straight to running it.

```bash
ollama list          # verify models are present
cd "C:\Users\Ankit Sharma\Documents\Default Project\bioledger"
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload
```

Open <http://localhost:8000> and:

1. Click **Load demo sightings** so the dashboard has data.
2. Log 2-3 real sightings (one from a **photo**, one text-only).
3. Ask a question in **Ask your journal**.

- Record a **15-30 second GIF** (ScreenToGif / LICEcap on Windows) or 2-3 screenshots.
- Save into `docs/` and reference them at the top of `DEV_POST.md` as the `cover_image` and inline.

## Step 5: Publish the DEV post

1. Open `DEV_POST.md`.
2. **Rewrite every `[[...]]` block in your own words** and add your screenshots/GIFs. This is
   non-negotiable for a prize, writing quality is weighted most and plagiarism is disqualified.
3. On DEV: **Create Post**, paste, set tags (`hacktoberfest`, `ai`, `opensource`, `python`),
   add your cover image, **Publish**.
4. Submit it at <https://dev.to/challenges/hacktoberfest-week1-2026-10-05>.
5. **Also enter the "Best Use of Gemma" partner category** on submission. The app runs Google's
   open-weight Gemma locally, so it's a genuine fit, and partner categories have a smaller pool,
   so your odds are better.

Verify the Week 1 sticker/entry appears at <https://hacktoberfest.com/my>.

## Step 6: Claim GHW challenges

Follow `GHW_CHECKLIST.md`, submitting each challenge from <https://ghw.mlh.com/challenges>.
Attend **at least 5 live sessions** for the bonus swag, and check in live when you do.

---

## What's already done for you

- Full working app: FastAPI + local Gemma + local embeddings + photo vision + SQLite/Timescale
  hybrid store + web UI.
- `db/schema.sql` with hypertable, continuous aggregate, and pgvector for the Tiger challenges.
- MCP server for agent access.
- README, MIT LICENSE, Dockerfile, docker-compose, `.env.example`.
- `DEV_POST.md` draft scaffolded to the Touch Grass theme + the five judging criteria.

## What only you can (and should) do

- Sign in to MyMLH / DEV / GitHub and claim stickers.
- Add your voice, screenshots, and personal story to the post.
- Push to GitHub, submit the DEV entry **and** the Gemma category, and submit GHW challenges,
  all before the deadlines above.
