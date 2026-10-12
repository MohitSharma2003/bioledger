"""Regression and contract tests for the Bioledger HTTP API.

These lock the behaviour the UI depends on: the offline-safe save path, the
provider registry, the new client-persist endpoint, and graceful degradation
when the local model is unavailable.
"""

import io

import llm
import store


def test_health_shape(client):
    body = client.get("/api/health").json()
    assert body["app"]
    assert body["backend"] == "sqlite"
    for key in ("ollama", "model", "model_present", "embed_model", "vision_model"):
        assert key in body


def test_models_registry_lists_server_and_client(client):
    body = client.get("/api/models").json()
    ids = {p["id"]: p for p in body["providers"]}
    assert "ollama" in ids
    assert "browser" in ids
    # The server only owns the Ollama runtime; the browser reports its own.
    assert ids["ollama"]["location"] == "server"
    assert ids["browser"]["location"] == "client"
    assert ids["browser"]["status"]["kind"] == "unknown"


def test_observe_saves_even_when_model_is_down(client, monkeypatch):
    def boom(*args, **kwargs):
        raise llm.LLMError("offline")

    monkeypatch.setattr(llm, "parse_observation", boom)

    resp = client.post("/api/observe", data={"text": "A grey squirrel in the maple."})
    assert resp.status_code == 200
    body = resp.json()
    assert body["ai_processed"] is False
    assert body["notice"]
    saved = body["observation"]
    assert saved["source"] == "user"
    assert "squirrel" in saved["text"]
    # The raw note survived, which is the whole point of offline-first.
    listed = client.get("/api/observations").json()
    assert any(row["id"] == saved["id"] for row in listed)


def test_observe_with_model_returns_parsed_fields(client, monkeypatch, sample_parsed):
    monkeypatch.setattr(llm, "parse_observation", lambda *a, **k: dict(sample_parsed))
    monkeypatch.setattr(llm, "embed", lambda *a, **k: None)

    resp = client.post("/api/observe", data={"text": "A copper dragonfly by the pond."})
    assert resp.status_code == 200
    body = resp.json()
    assert body["ai_processed"] is True
    assert body["observation"]["species"] == "Common Darter"
    assert body["observation"]["category"] == "insect"


def test_observe_requires_text_or_photo(client):
    resp = client.post("/api/observe", data={"text": "   "})
    assert resp.status_code == 400


def test_observe_rejects_non_image_upload(client):
    files = {"photo": ("notes.txt", io.BytesIO(b"hello"), "text/plain")}
    resp = client.post("/api/observe", data={"text": "x"}, files=files)
    assert resp.status_code == 415


def test_observe_rejects_oversize_photo(client, monkeypatch):
    import config

    monkeypatch.setattr(config, "MAX_IMAGE_BYTES", 8)
    files = {"photo": ("big.png", io.BytesIO(b"x" * 64), "image/png")}
    resp = client.post("/api/observe", data={"text": "x"}, files=files)
    assert resp.status_code == 413


def test_create_observation_persists_without_model(client):
    payload = {
        "text": "Bright orange fungus on a dead oak stump.",
        "species": "Chicken of the Woods",
        "category": "fungus",
        "confidence": 0.55,
        "note": "Sulphur-orange shelves.",
        "tags": ["fungus", "oak"],
    }
    resp = client.post("/api/observations", json=payload)
    assert resp.status_code == 201
    body = resp.json()
    assert body["species"] == "Chicken of the Woods"
    assert body["source"] == "user"
    detail = client.get(f"/api/observations/{body['id']}")
    assert detail.status_code == 200
    assert detail.json()["id"] == body["id"]


def test_create_observation_clamps_bad_values(client):
    payload = {"text": "Something", "confidence": 9, "tags": ["a"], "category": ""}
    resp = client.post("/api/observations", json=payload)
    assert resp.status_code == 201
    assert resp.json()["confidence"] <= 1.0


def test_create_observation_requires_text(client):
    resp = client.post("/api/observations", json={"text": "  "})
    assert resp.status_code == 400


def test_ask_present_mode_returns_sources(client, monkeypatch):
    monkeypatch.setattr(llm, "answer", lambda *a, **k: "Two fungi this month.")
    client.post("/api/observations", json={"text": "Fungus", "category": "fungus"})
    resp = client.post("/api/ask", json={"question": "what fungi did I see?"})
    assert resp.status_code == 200
    body = resp.json()
    assert body["mode"] == "model"
    assert body["answer"] == "Two fungi this month."
    assert body["sources"]


def test_ask_offline_is_graceful(client, monkeypatch):
    monkeypatch.setattr(llm, "answer", lambda *a, **k: "")
    resp = client.post("/api/ask", json={"question": "anything?"})
    assert resp.status_code == 200
    body = resp.json()
    assert body["mode"] == "offline"
    assert body["sources"] == []


def test_season_shape(client):
    body = client.get("/api/season").json()
    assert "month" in body
    assert isinstance(body["species"], list)


def test_observation_detail_missing_is_404(client):
    assert client.get("/api/observations/999999").status_code == 404


def test_unknown_api_route_is_404(client):
    assert client.get("/api/does-not-exist").status_code == 404


def test_spa_fallback_serves_index(client):
    # Direct links and reloads must return the app shell, not a JSON 404.
    resp = client.get("/sightings")
    assert resp.status_code == 200
    assert "text/html" in resp.headers.get("content-type", "")


def test_demo_seed_is_retagged(client):
    client.post("/api/seed")
    rows = client.get("/api/observations").json()
    assert rows
    assert all(row["source"] == "demo" for row in rows)


def test_default_model_is_gemma3_4b(client):
    import config

    assert config.MODEL == "gemma3:4b"
    body = client.get("/api/health").json()
    assert body["model"] == "gemma3:4b"


def test_models_registry_ollama_is_the_default_model(client):
    body = client.get("/api/models").json()
    ollama = next(p for p in body["providers"] if p["id"] == "ollama")
    text_models = [m for m in ollama["models"] if m["role"] == "text"]
    assert len(text_models) == 1
    assert text_models[0]["id"] == "gemma3:4b"


def test_ollama_status_does_not_use_mobile_model_as_fallback(client, monkeypatch):
    def fake_status():
        return {
            "ollama": True,
            "models": ["gemma3:4b"],
            "model": "gemma3:4b",
            "model_present": True,
            "embed_model": "nomic-embed-text",
            "embed_present": False,
            "vision_model": "gemma3:4b",
            "vision_present": True,
        }

    monkeypatch.setattr(llm, "status", fake_status)
    body = client.get("/api/models").json()
    ollama = next(p for p in body["providers"] if p["id"] == "ollama")
    assert ollama["status"]["kind"] == "ready"
    assert "gemma3:4b" in ollama["status"]["detail"]


def test_missing_default_model_reads_not_installed(client, monkeypatch):
    # With the default model absent the server says so plainly. It never
    # substitutes the optional browser model.
    def fake_status():
        return {
            "ollama": True,
            "models": [],
            "model": "gemma3:4b",
            "model_present": False,
            "embed_model": "nomic-embed-text",
            "embed_present": False,
            "vision_model": "gemma3:4b",
            "vision_present": False,
        }

    monkeypatch.setattr(llm, "status", fake_status)
    body = client.get("/api/models").json()
    ollama = next(p for p in body["providers"] if p["id"] == "ollama")
    assert ollama["status"]["kind"] == "not_installed"
    assert "gemma3:4b" in ollama["status"]["detail"]

