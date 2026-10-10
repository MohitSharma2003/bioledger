import base64
import os
from typing import List, Optional

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

import config
import llm
import store as store_module
from schemas import (
    AskIn,
    AskOut,
    HealthOut,
    Observation,
    ObserveResponse,
    SimilarResult,
    Stats,
)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
STATIC_DIR = os.path.join(BASE_DIR, "static")

app = FastAPI(title=config.APP_NAME, description=config.APP_TAGLINE)


def _store():
    return store_module.get_store()


@app.on_event("startup")
def _startup() -> None:
    _store()


@app.get("/api/health", response_model=HealthOut)
def health() -> HealthOut:
    status = llm.status()
    return HealthOut(
        app=config.APP_NAME,
        backend=_store().backend,
        ollama=status.get("ollama", False),
        model=status.get("model", config.MODEL),
        model_present=status.get("model_present", False),
        embed_model=status.get("embed_model", config.EMBED_MODEL),
        embed_present=status.get("embed_present", False),
        vision_model=status.get("vision_model", config.VISION_MODEL),
        vision_present=status.get("vision_present", False),
    )


@app.post("/api/observe", response_model=ObserveResponse)
def observe(
    text: str = Form(""),
    place: str = Form(""),
    lat: Optional[float] = Form(None),
    lon: Optional[float] = Form(None),
    photo: Optional[UploadFile] = File(None),
) -> ObserveResponse:
    text = (text or "").strip()
    if not text and photo is None:
        raise HTTPException(status_code=400, detail="Describe what you saw, or add a photo.")

    image_b64 = None
    if photo is not None:
        content_type = (photo.content_type or "").lower()
        if content_type and not content_type.startswith("image/"):
            raise HTTPException(status_code=415, detail="That file is not an image. Try a JPG, PNG, or WebP.")
        raw = photo.file.read()
        if not raw:
            raise HTTPException(status_code=400, detail="That photo was empty.")
        if len(raw) > config.MAX_IMAGE_BYTES:
            limit_mb = config.MAX_IMAGE_BYTES // (1024 * 1024)
            raise HTTPException(status_code=413, detail=f"Photo is larger than {limit_mb} MB.")
        image_b64 = base64.b64encode(raw).decode("ascii")

    # The observation is saved no matter what the model does. If the model is
    # unavailable we keep the raw note and explain what happened instead of
    # silently discarding the sighting.
    ai_processed = True
    notice = None
    try:
        parsed = llm.parse_observation(text, image_b64=image_b64)
    except llm.LLMError as exc:
        ai_processed = False
        notice = (
            "Saved to your ledger. The local model could not read it just now "
            f"({exc}). Your note and photo are safe \u2014 start Ollama and log it again "
            "to get a full field note."
        )
        parsed = {
            "species": "unidentified sighting",
            "common_name": None,
            "category": "other",
            "confidence": 0.0,
            "note": "",
            "tags": [],
            "season_note": None,
        }

    obs = {
        "created_at": store_module.now_iso(),
        "text": text or "(photo observation)",
        "place": place or None,
        "lat": lat,
        "lon": lon,
        **parsed,
    }
    embedding = llm.embed(f"{obs['species']} {obs['note']} {obs['text']}".strip()) if ai_processed else None
    store = _store()
    obs_id = store.add_observation(obs, embedding)
    saved, _ = store.get_observation(obs_id)
    similar = store.find_similar(embedding, k=3, exclude_id=obs_id) if embedding else []

    return ObserveResponse(
        observation=Observation(**saved),
        similar=[SimilarResult(**item) for item in similar],
        in_season=store.species_in_season(),
        used_vision=ai_processed and image_b64 is not None,
        ai_processed=ai_processed,
        notice=notice,
    )


@app.post("/api/ask", response_model=AskOut)
def ask(body: AskIn) -> AskOut:
    store = _store()
    context = store.context_for()
    text = llm.answer(body.question, context)
    if not text:
        return AskOut(
            answer=(
                "I could not reach the local model just now. Your journal is still safe on disk — "
                "start Ollama and try again."
            ),
            sources=[],
            mode="offline",
        )
    sources = [Observation(**row) for row in store.list_observations(limit=5)]
    return AskOut(answer=text, sources=sources, mode="model")


@app.get("/api/observations", response_model=List[Observation])
def observations(
    limit: int = 100,
    q: str = "",
    category: str = "",
) -> List[Observation]:
    store = _store()
    if q.strip() or category.strip():
        rows = store.search_observations(query=q, category=category, limit=limit)
    else:
        rows = store.list_observations(limit=limit)
    return [Observation(**row) for row in rows]


@app.get("/api/observations/{obs_id}", response_model=Observation)
def observation_detail(obs_id: int) -> Observation:
    row, _ = _store().get_observation(obs_id)
    if row is None:
        raise HTTPException(status_code=404, detail="No such observation.")
    return Observation(**row)


@app.get("/api/categories")
def categories() -> dict:
    return {"categories": _store().categories()}


@app.get("/api/stats", response_model=Stats)
def stats() -> Stats:
    return Stats(**_store().stats())


@app.get("/api/season")
def season(month: Optional[int] = None) -> dict:
    return {"species": _store().species_in_season(month)}


@app.get("/api/timeline")
def timeline(days: int = 30) -> dict:
    return {"days": _store().timeline(days)}


@app.post("/api/seed")
def seed_demo() -> dict:
    import seed as seed_module

    count = seed_module.seed(_store())
    return {"seeded": count}


@app.get("/")
def index() -> FileResponse:
    return FileResponse(os.path.join(STATIC_DIR, "index.html"))


app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")
