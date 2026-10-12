"""Shared fixtures for the Bioledger API tests.

Every test runs against a fresh throwaway SQLite file and never talks to
Ollama, so the suite is offline and safe to run anywhere.
"""

import os
import pathlib
import tempfile

# Point config at a scratch database and photo directory before they are
# imported anywhere.
os.environ["BIOLEDGER_DB"] = str(
    pathlib.Path(tempfile.mkdtemp(prefix="bioledger-tests-")) / "session.db"
)
os.environ["BIOLEDGER_PHOTO_DIR"] = str(
    pathlib.Path(tempfile.mkdtemp(prefix="bioledger-photos-"))
)
os.environ.pop("DATABASE_URL", None)

import pytest
from fastapi.testclient import TestClient

import config
import store
import main


@pytest.fixture()
def client(tmp_path, monkeypatch):
    """A TestClient bound to a private database, with Ollama stubbed out."""
    monkeypatch.setattr(config, "SQLITE_PATH", str(tmp_path / "bioledger.db"))
    monkeypatch.setattr(config, "PHOTO_DIR", str(tmp_path / "photos"))
    monkeypatch.setattr(config, "DATABASE_URL", "")
    store._store = None
    with TestClient(main.app) as test_client:
        yield test_client
    store._store = None


@pytest.fixture()
def sample_parsed():
    return {
        "species": "Common Darter",
        "common_name": "Common Darter dragonfly",
        "category": "insect",
        "confidence": 0.62,
        "note": "A copper darter held one reed.",
        "tags": ["dragonfly", "pond"],
        "season_note": "Warm months near still water.",
    }
