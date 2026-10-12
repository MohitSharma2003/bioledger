"""Photo persistence: storage, serving, safety, and failure isolation.

The photo path must never cost the user their observation, must not be
traversable, and must degrade to "no photo" when the file goes missing.
"""

import io
import os

import config
import llm
import photos

# A real PNG signature plus filler; the store validates the leading bytes, not
# the whole image, so this exercises the same path a real upload would.
PNG = b"\x89PNG\r\n\x1a\n" + b"\x00" * 64
JPEG = b"\xff\xd8\xff\xe0" + b"\x00" * 64


def _stub_model(monkeypatch):
    parsed = {
        "species": "Ivy",
        "common_name": "Common ivy",
        "category": "plant",
        "confidence": 0.7,
        "note": "Climbing the fence.",
        "tags": ["ivy"],
        "season_note": None,
    }
    monkeypatch.setattr(llm, "parse_observation", lambda *a, **k: dict(parsed))
    monkeypatch.setattr(llm, "embed", lambda *a, **k: None)


def _upload(client, raw=PNG, name="leaf.png", mime="image/png", text="A leaf."):
    files = {"photo": (name, io.BytesIO(raw), mime)}
    return client.post("/api/observe", data={"text": text}, files=files)


def test_observe_persists_photo_and_serves_it(client, monkeypatch):
    _stub_model(monkeypatch)
    resp = _upload(client)
    assert resp.status_code == 200
    obs = resp.json()["observation"]
    assert obs["photo_url"].startswith("/api/photos/")
    assert obs["photo_mime"] == "image/png"
    assert obs["photo_bytes"] == len(PNG)

    img = client.get(obs["photo_url"])
    assert img.status_code == 200
    assert img.headers["content-type"] == "image/png"
    assert img.content == PNG


def test_photo_survives_reload(client, monkeypatch):
    _stub_model(monkeypatch)
    obs = _upload(client).json()["observation"]
    reloaded = client.get(f"/api/observations/{obs['id']}").json()
    assert reloaded["photo_url"] == obs["photo_url"]
    assert reloaded["photo_mime"] == "image/png"


def test_attach_photo_to_existing_observation(client):
    created = client.post("/api/observations", json={"text": "A mushroom."}).json()
    assert created["photo_url"] is None

    files = {"photo": ("cap.jpg", io.BytesIO(JPEG), "image/jpeg")}
    resp = client.post(f"/api/observations/{created['id']}/photo", files=files)
    assert resp.status_code == 200
    body = resp.json()
    assert body["photo_url"].startswith("/api/photos/")
    assert body["photo_mime"] == "image/jpeg"
    assert client.get(body["photo_url"]).content == JPEG


def test_attach_photo_missing_observation_is_404(client):
    files = {"photo": ("cap.jpg", io.BytesIO(JPEG), "image/jpeg")}
    resp = client.post("/api/observations/999999/photo", files=files)
    assert resp.status_code == 404


def test_missing_photo_file_is_handled_gracefully(client, monkeypatch):
    _stub_model(monkeypatch)
    obs = _upload(client).json()["observation"]
    name = obs["photo_url"].rsplit("/", 1)[-1]

    photos.remove(name)

    reloaded = client.get(f"/api/observations/{obs['id']}").json()
    assert reloaded["photo_url"] is None
    assert client.get(f"/api/photos/{name}").status_code == 404


def test_photo_names_are_not_traversable(client):
    for bad in (
        "../config.py",
        "..%2f..%2fconfig.py",
        "not-a-generated-name.png",
        "a" * 31 + ".png",
    ):
        assert client.get(f"/api/photos/{bad}").status_code == 404


def test_observe_keeps_observation_when_photo_store_fails(client, monkeypatch):
    _stub_model(monkeypatch)

    def boom(*args, **kwargs):
        raise photos.PhotoError("the disk is full")

    monkeypatch.setattr(photos, "save", boom)

    resp = _upload(client)
    assert resp.status_code == 200
    body = resp.json()
    assert body["ai_processed"] is True
    saved = body["observation"]
    assert saved["photo_url"] is None
    assert "photo was not stored" in (body["notice"] or "")
    # The sighting itself is safe.
    listed = client.get("/api/observations").json()
    assert any(row["id"] == saved["id"] for row in listed)


def test_stored_photo_is_not_the_client_filename(client, monkeypatch):
    _stub_model(monkeypatch)
    obs = _upload(client, name="my holiday photo.png").json()["observation"]
    name = obs["photo_url"].rsplit("/", 1)[-1]
    assert "holiday" not in name
    assert name.endswith(".png")
    stored = os.listdir(config.PHOTO_DIR)
    assert name in stored
