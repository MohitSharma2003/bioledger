"""The store backend chooser must never let Postgres take SQLite down.

Postgres/Tiger is an optional, additive backend. If it is requested but cannot
be reached, the app keeps working on the local SQLite default.
"""

import config
import store


def test_defaults_to_sqlite_when_no_database_url(monkeypatch, tmp_path):
    monkeypatch.setattr(config, "DATABASE_URL", "")
    monkeypatch.setattr(config, "SQLITE_PATH", str(tmp_path / "local.db"))
    store._store = None
    try:
        chosen = store.get_store()
        assert chosen.backend == "sqlite"
    finally:
        store._store = None


def test_unreachable_postgres_falls_back_to_sqlite(monkeypatch, tmp_path):
    class Unreachable:
        backend = "postgres"

        def __init__(self, url):
            self.url = url

        def init(self):
            raise RuntimeError("no server listening")

    monkeypatch.setattr(store, "PostgresStore", Unreachable)
    monkeypatch.setattr(config, "DATABASE_URL", "postgres://127.0.0.1:1/none")
    monkeypatch.setattr(config, "SQLITE_PATH", str(tmp_path / "local.db"))
    store._store = None
    try:
        chosen = store.get_store()
        assert chosen.backend == "sqlite"
        assert chosen.stats()["total"] == 0
    finally:
        store._store = None
