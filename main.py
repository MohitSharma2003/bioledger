import base64
import os
from typing import List, Optional

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

import config
import llm
import photos
import providers
import store as store_module
from schemas import (
    AskIn,
    AskOut,
    HealthOut,
    NewObservation,
    Observation,
    ObserveResponse,
    SimilarResult,
    Stats,
)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
STATIC_DIR = os.path.join(BASE_DIR, "static")

app = FastAPI(title=config.APP_NAME, description=config.APP_TAGLINE)

if config.CORS_ORIGINS:
    from fastapi.middleware.cors import CORSMiddleware

    app.add_middleware(
        CORSMiddleware,
        allow_origins=config.CORS_ORIGINS,
        allow_credentials=False,
        allow_methods=["*"],
        allow_headers=["*"],
    )


def _store():
    return store_module.get_store()


def _present(row: dict) -> Observation:
    """Shape a stored row for the API, turning the photo filename into a URL.

    The on-disk filename never leaves the server; if the file is missing the
    URL is simply absent and the rest of the record still renders.
    """
    data = dict(row)
    name = data.pop("photo_path", None)
    data["photo_url"] = photos.url_for(name)
    return Observation(**data)


@app.on_event("startup")
def _startup() -> None:
    # A fresh box may mount the data volume after the working directory exists,
    # so create the SQLite file's parent directory before initialising the store.
    os.makedirs(os.path.dirname(os.path.abspath(config.SQLITE_PATH)), exist_ok=True)
    _store()
    photos.ensure_dir()


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


@app.get("/api/models")
def models() -> dict:
    """The model runtimes the UI may offer, with the server-side status.

    The browser runtime reports its own status client-side; the server never
    claims a state it cannot observe.
    """
    return {"providers": providers.registry()}


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
    raw = None
    content_type = ""
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
            "Saved to your ledger, but the local model could not read it just now "
            f"({exc}). Start Ollama and record the sighting again to get an "
            "identification for it."
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

    # Persist the photo on its own. A disk problem must not cost the user their
    # note: we still store the observation and say the photo was not kept.
    photo_fields = {}
    if raw is not None:
        try:
            photo_fields = photos.save(raw, content_type)
        except photos.PhotoError as exc:
            photo_notice = f"Your note was saved, but the photo was not stored ({exc})."
            notice = f"{notice} {photo_notice}".strip() if notice else photo_notice

    obs = {
        "created_at": store_module.now_iso(),
        "text": text or "(photo observation)",
        "place": place or None,
        "lat": lat,
        "lon": lon,
        "source": "user",
        **parsed,
        **photo_fields,
    }
    embedding = llm.embed(f"{obs['species']} {obs['note']} {obs['text']}".strip()) if ai_processed else None
    store = _store()
    try:
        obs_id = store.add_observation(obs, embedding)
    except Exception:
        # The record could not be written, so the just-saved photo is orphaned.
        photos.remove(photo_fields.get("photo_path"))
        raise
    saved, _ = store.get_observation(obs_id)
    similar = store.find_similar(embedding, k=3, exclude_id=obs_id) if embedding else []

    return ObserveResponse(
        observation=_present(saved),
        similar=[
            SimilarResult(observation=_present(item["observation"]), score=item["score"])
            for item in similar
        ],
        in_season=store.species_in_season(),
        used_vision=ai_processed and image_b64 is not None,
        ai_processed=ai_processed,
        notice=notice,
    )


@app.post("/api/observations", response_model=Observation, status_code=201)
def create_observation(body: NewObservation) -> Observation:
    """Store an observation that was parsed outside the server.

    This is the save path for the browser runtime: the client did the model
    work, the server only validates the shape and keeps the record. No model
    is called here, so it works with Ollama switched off.
    """
    text = (body.text or "").strip()
    if not text:
        raise HTTPException(status_code=400, detail="Describe what you saw.")

    try:
        parsed = llm.normalize_observation(body.model_dump())
    except llm.LLMError as exc:
        raise HTTPException(status_code=422, detail=str(exc))

    obs = {
        "created_at": store_module.now_iso(),
        "text": text,
        "place": (body.place or "").strip() or None,
        "lat": body.lat,
        "lon": body.lon,
        "source": (body.source or "user").strip() or "user",
        **parsed,
    }
    store = _store()
    obs_id = store.add_observation(obs, None)
    saved, _ = store.get_observation(obs_id)
    return _present(saved)


@app.post("/api/observations/{obs_id}/photo", response_model=Observation)
def attach_photo(obs_id: int, photo: UploadFile = File(...)) -> Observation:
    """Attach a photo to an observation that was saved without one.

    This is the browser runtime's photo path: the client already stored the
    parsed observation, then uploads the image here. A bad or oversized upload
    is refused, but the observation itself is untouched.
    """
    store = _store()
    row, _ = store.get_observation(obs_id)
    if row is None:
        raise HTTPException(status_code=404, detail="No such observation.")

    content_type = (photo.content_type or "").lower()
    if content_type and not content_type.startswith("image/"):
        raise HTTPException(status_code=415, detail="That file is not an image. Try a JPG, PNG, or WebP.")
    raw = photo.file.read()
    if not raw:
        raise HTTPException(status_code=400, detail="That photo was empty.")
    if len(raw) > config.MAX_IMAGE_BYTES:
        limit_mb = config.MAX_IMAGE_BYTES // (1024 * 1024)
        raise HTTPException(status_code=413, detail=f"Photo is larger than {limit_mb} MB.")

    try:
        fields = photos.save(raw, content_type)
    except photos.PhotoError as exc:
        raise HTTPException(status_code=422, detail=str(exc))

    previous = row.get("photo_path")
    store.set_photo(obs_id, fields["photo_path"], fields["photo_mime"], fields["photo_bytes"])
    if previous and previous != fields["photo_path"]:
        photos.remove(previous)
    updated, _ = store.get_observation(obs_id)
    return _present(updated)


@app.get("/api/photos/{name}")
def photo_file(name: str) -> FileResponse:
    path = photos.resolve(name)
    if path is None:
        raise HTTPException(status_code=404, detail="No such photo.")
    return FileResponse(path, media_type=photos.media_type(name))


@app.post("/api/ask", response_model=AskOut)
def ask(body: AskIn) -> AskOut:
    store = _store()
    context = store.context_for()
    text = llm.answer(body.question, context)
    if not text:
        return AskOut(
            answer=(
                "I could not reach the local model just now. Your journal is still "
                "safe on disk; start Ollama and try again."
            ),
            sources=[],
            mode="offline",
        )
    # These are the same recent records the model was given as context, not a
    # separate retrieval result. The UI labels them accordingly.
    sources = [_present(row) for row in store.list_observations(limit=40)]
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
    return [_present(row) for row in rows]


@app.get("/api/observations/{obs_id}", response_model=Observation)
def observation_detail(obs_id: int) -> Observation:
    row, _ = _store().get_observation(obs_id)
    if row is None:
        raise HTTPException(status_code=404, detail="No such observation.")
    return _present(row)


@app.get("/api/categories")
def categories() -> dict:
    return {"categories": _store().categories()}


@app.get("/api/stats", response_model=Stats)
def stats() -> Stats:
    return Stats(**_store().stats())


@app.get("/api/season")
def season(month: Optional[int] = None) -> dict:
    resolved = month or store_module.datetime.now(store_module.timezone.utc).month
    return {"month": resolved, "species": _store().species_in_season(month)}


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


@app.get("/manifest.webmanifest")
def manifest() -> FileResponse:
    """The web app manifest, served from the site root so the install scope is "/"."""
    path = os.path.join(STATIC_DIR, "manifest.webmanifest")
    if not os.path.isfile(path):
        raise HTTPException(status_code=404, detail="No manifest built yet")
    return FileResponse(path, media_type="application/manifest+json")


@app.get("/sw.js")
def service_worker() -> FileResponse:
    """The service worker, served from the root so its scope can cover the app.

    The browser refuses a root scope for a script under /static, hence the
    Service-Worker-Allowed header and this dedicated route.
    """
    path = os.path.join(STATIC_DIR, "sw.js")
    if not os.path.isfile(path):
        raise HTTPException(status_code=404, detail="No service worker built yet")
    return FileResponse(
        path,
        media_type="text/javascript",
        headers={"Service-Worker-Allowed": "/", "Cache-Control": "no-cache"},
    )


@app.get("/{full_path:path}")
def spa(full_path: str) -> FileResponse:
    """Serve the single-page app for client-side routes.

    Recognised API and asset prefixes are kept out of this catch-all so they
    still return a normal 404 instead of the app shell.
    """
    if full_path.startswith(("api/", "static/")):
        raise HTTPException(status_code=404, detail="Not found")
    if full_path:
        candidate = os.path.abspath(os.path.join(STATIC_DIR, full_path))
        if candidate.startswith(os.path.abspath(STATIC_DIR)) and os.path.isfile(candidate):
            return FileResponse(candidate)
    return FileResponse(os.path.join(STATIC_DIR, "index.html"))
