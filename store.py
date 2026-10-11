import json
import math
import os
import sqlite3
from datetime import datetime, timedelta, timezone

import config


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def cosine(a, b) -> float:
    if not a or not b:
        return 0.0
    n = min(len(a), len(b))
    dot = sum(a[i] * b[i] for i in range(n))
    na = math.sqrt(sum(x * x for x in a[:n]))
    nb = math.sqrt(sum(x * x for x in b[:n]))
    if na == 0 or nb == 0:
        return 0.0
    return dot / (na * nb)


def _streak(isos) -> int:
    days = set()
    for stamp in isos:
        try:
            days.add(datetime.fromisoformat(stamp).date())
        except Exception:
            continue
    streak = 0
    day = datetime.now(timezone.utc).date()
    while day in days:
        streak += 1
        day -= timedelta(days=1)
    return streak


class SQLiteStore:
    backend = "sqlite"

    def __init__(self, path: str):
        self.path = path

    def _conn(self):
        con = sqlite3.connect(self.path)
        con.row_factory = sqlite3.Row
        return con

    def init(self) -> None:
        with self._conn() as con:
            con.execute(
                """
                CREATE TABLE IF NOT EXISTS observations (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    created_at TEXT NOT NULL,
                    text TEXT NOT NULL,
                    place TEXT,
                    lat REAL,
                    lon REAL,
                    species TEXT,
                    common_name TEXT,
                    category TEXT,
                    confidence REAL,
                    note TEXT,
                    tags TEXT,
                    season_note TEXT,
                    embedding TEXT,
                    source TEXT DEFAULT 'user'
                )
                """
            )
            columns = [row[1] for row in con.execute("PRAGMA table_info(observations)")]
            if "source" not in columns:
                con.execute(
                    "ALTER TABLE observations ADD COLUMN source TEXT DEFAULT 'user'"
                )

    @staticmethod
    def _row(row) -> dict:
        data = dict(row)
        data["tags"] = json.loads(data.get("tags") or "[]")
        data.pop("embedding", None)
        return data

    def add_observation(self, obs: dict, embedding) -> int:
        with self._conn() as con:
            cur = con.execute(
                """
                INSERT INTO observations
                (created_at, text, place, lat, lon, species, common_name, category,
                 confidence, note, tags, season_note, embedding, source)
                VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
                """,
                (
                    obs.get("created_at") or now_iso(),
                    obs.get("text", ""),
                    obs.get("place"),
                    obs.get("lat"),
                    obs.get("lon"),
                    obs.get("species"),
                    obs.get("common_name"),
                    obs.get("category"),
                    float(obs.get("confidence") or 0.0),
                    obs.get("note"),
                    json.dumps(obs.get("tags") or []),
                    obs.get("season_note"),
                    json.dumps(embedding) if embedding else None,
                    obs.get("source") or "user",
                ),
            )
            return cur.lastrowid

    def list_observations(self, limit: int = 100):
        with self._conn() as con:
            rows = con.execute(
                "SELECT * FROM observations ORDER BY created_at DESC LIMIT ?", (limit,)
            ).fetchall()
        return [self._row(r) for r in rows]

    def search_observations(self, query: str = "", category: str = "", limit: int = 100):
        sql = "SELECT * FROM observations"
        clauses, params = [], []
        q = (query or "").strip().lower()
        if q:
            like = f"%{q}%"
            clauses.append(
                "(lower(species) LIKE ? OR lower(IFNULL(common_name,'')) LIKE ? "
                "OR lower(text) LIKE ? OR lower(IFNULL(note,'')) LIKE ? "
                "OR lower(IFNULL(tags,'')) LIKE ? OR lower(IFNULL(place,'')) LIKE ?)"
            )
            params.extend([like] * 6)
        if category:
            clauses.append("lower(IFNULL(category,'')) = ?")
            params.append(category.strip().lower())
        if clauses:
            sql += " WHERE " + " AND ".join(clauses)
        sql += " ORDER BY created_at DESC LIMIT ?"
        params.append(limit)
        with self._conn() as con:
            rows = con.execute(sql, params).fetchall()
        return [self._row(r) for r in rows]

    def categories(self):
        with self._conn() as con:
            rows = con.execute(
                "SELECT lower(IFNULL(category,'other')) c, COUNT(*) n FROM observations "
                "GROUP BY lower(IFNULL(category,'other')) ORDER BY n DESC, c ASC"
            ).fetchall()
        return [{"category": r["c"], "count": r["n"]} for r in rows]

    def get_observation(self, obs_id: int):
        with self._conn() as con:
            row = con.execute("SELECT * FROM observations WHERE id = ?", (obs_id,)).fetchone()
            emb = con.execute("SELECT embedding FROM observations WHERE id = ?", (obs_id,)).fetchone()
        if row is None:
            return None, None
        emb_value = json.loads(emb["embedding"]) if emb and emb["embedding"] else None
        return self._row(row), emb_value

    def find_similar(self, embedding, k: int = 5, exclude_id=None):
        if not embedding:
            return []
        with self._conn() as con:
            rows = con.execute("SELECT * FROM observations").fetchall()
        scored = []
        for row in rows:
            if exclude_id is not None and row["id"] == exclude_id:
                continue
            try:
                emb = json.loads(row["embedding"]) if row["embedding"] else None
            except Exception:
                emb = None
            scored.append((cosine(embedding, emb), row))
        scored.sort(key=lambda item: item[0], reverse=True)
        return [
            {"observation": self._row(row), "score": round(score, 4)}
            for score, row in scored[:k]
        ]

    def stats(self) -> dict:
        with self._conn() as con:
            total = con.execute("SELECT COUNT(*) c FROM observations").fetchone()["c"]
            species = con.execute(
                "SELECT COUNT(DISTINCT lower(species)) c FROM observations"
            ).fetchone()["c"]
            week = con.execute(
                "SELECT COUNT(*) c FROM observations WHERE created_at >= ?",
                ((datetime.now(timezone.utc) - timedelta(days=7)).isoformat(),),
            ).fetchone()["c"]
            rows = con.execute("SELECT created_at FROM observations").fetchall()
            top = con.execute(
                "SELECT species, COUNT(*) c FROM observations "
                "GROUP BY lower(species) ORDER BY c DESC LIMIT 5"
            ).fetchall()
        return {
            "total": total,
            "species": species,
            "this_week": week,
            "streak_days": _streak([r["created_at"] for r in rows]),
            "top_species": [{"species": r["species"], "count": r["c"]} for r in top],
        }

    def timeline(self, days: int = 30):
        with self._conn() as con:
            rows = con.execute("SELECT created_at FROM observations").fetchall()
        counts = {}
        for row in rows:
            try:
                key = datetime.fromisoformat(row["created_at"]).date().isoformat()
            except Exception:
                continue
            counts[key] = counts.get(key, 0) + 1
        today = datetime.now(timezone.utc).date()
        return [
            {"date": (today - timedelta(days=i)).isoformat(), "count": counts.get((today - timedelta(days=i)).isoformat(), 0)}
            for i in range(days - 1, -1, -1)
        ]

    def species_in_season(self, month: int = None):
        month = month or datetime.now(timezone.utc).month
        with self._conn() as con:
            rows = con.execute("SELECT created_at, species FROM observations").fetchall()
        agg = {}
        for row in rows:
            try:
                m = datetime.fromisoformat(row["created_at"]).month
            except Exception:
                continue
            if m == month:
                key = row["species"]
                agg[key] = agg.get(key, 0) + 1
        return sorted(
            ({"species": k, "count": v} for k, v in agg.items()),
            key=lambda item: item["count"],
            reverse=True,
        )

    def context_for(self, limit: int = 40) -> str:
        observations = self.list_observations(limit=limit)
        lines = [
            f"- {o['created_at'][:10]} | {o['species']} ({o['category']}, "
            f"conf {o['confidence']:.2f}) at {o.get('place') or 'unrecorded'}: {o.get('note')}"
            for o in observations
        ]
        return "\n".join(lines) if lines else "(the journal is empty)"


class PostgresStore:
    backend = "postgres"

    def __init__(self, url: str):
        self.url = url

    def _conn(self):
        import psycopg
        from psycopg.rows import dict_row

        return psycopg.connect(self.url, autocommit=True, row_factory=dict_row)

    def init(self) -> None:
        schema_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "db", "schema.sql")
        with open(schema_path, "r", encoding="utf-8") as handle:
            sql = handle.read()
        with self._conn() as con:
            con.execute(sql)

    @staticmethod
    def _row(row) -> dict:
        data = dict(row)
        data["tags"] = data.get("tags") or []
        data.pop("embedding", None)
        return data

    @staticmethod
    def _vec(embedding):
        if not embedding:
            return None
        return "[" + ",".join(str(float(x)) for x in embedding) + "]"

    def add_observation(self, obs: dict, embedding) -> int:
        with self._conn() as con:
            row = con.execute(
                """
                INSERT INTO observations
                (created_at, text, place, lat, lon, species, common_name, category,
                 confidence, note, tags, season_note, embedding, source)
                VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s::vector,%s)
                RETURNING id
                """,
                (
                    obs.get("created_at") or now_iso(),
                    obs.get("text", ""),
                    obs.get("place"),
                    obs.get("lat"),
                    obs.get("lon"),
                    obs.get("species"),
                    obs.get("common_name"),
                    obs.get("category"),
                    float(obs.get("confidence") or 0.0),
                    obs.get("note"),
                    obs.get("tags") or [],
                    obs.get("season_note"),
                    self._vec(embedding),
                    obs.get("source") or "user",
                ),
            ).fetchone()
            return row["id"]

    def list_observations(self, limit: int = 100):
        with self._conn() as con:
            rows = con.execute(
                "SELECT * FROM observations ORDER BY created_at DESC LIMIT %s", (limit,)
            ).fetchall()
        return [self._row(r) for r in rows]

    def search_observations(self, query: str = "", category: str = "", limit: int = 100):
        sql = "SELECT * FROM observations"
        clauses, params = [], []
        q = (query or "").strip().lower()
        if q:
            like = f"%{q}%"
            clauses.append(
                "(lower(species) LIKE %s OR lower(coalesce(common_name,'')) LIKE %s "
                "OR lower(text) LIKE %s OR lower(coalesce(note,'')) LIKE %s "
                "OR lower(coalesce(place,'')) LIKE %s "
                "OR lower(coalesce(array_to_string(tags, ' '),'')) LIKE %s)"
            )
            params.extend([like] * 6)
        if category:
            clauses.append("lower(coalesce(category,'')) = %s")
            params.append(category.strip().lower())
        if clauses:
            sql += " WHERE " + " AND ".join(clauses)
        sql += " ORDER BY created_at DESC LIMIT %s"
        params.append(limit)
        with self._conn() as con:
            rows = con.execute(sql, params).fetchall()
        return [self._row(r) for r in rows]

    def categories(self):
        with self._conn() as con:
            rows = con.execute(
                "SELECT lower(coalesce(category,'other')) c, COUNT(*) n FROM observations "
                "GROUP BY lower(coalesce(category,'other')) ORDER BY n DESC, c ASC"
            ).fetchall()
        return [{"category": r["c"], "count": r["n"]} for r in rows]

    def get_observation(self, obs_id: int):
        with self._conn() as con:
            row = con.execute("SELECT * FROM observations WHERE id = %s", (obs_id,)).fetchone()
        if row is None:
            return None, None
        return self._row(row), None

    def find_similar(self, embedding, k: int = 5, exclude_id=None):
        if not embedding:
            return []
        with self._conn() as con:
            rows = con.execute(
                "SELECT *, 1 - (embedding <=> %s::vector) AS score FROM observations "
                "WHERE (%s IS NULL OR id <> %s) ORDER BY embedding <=> %s::vector LIMIT %s",
                (self._vec(embedding), exclude_id, exclude_id, self._vec(embedding), k),
            ).fetchall()
        return [
            {"observation": self._row(r), "score": round(float(r["score"] or 0.0), 4)}
            for r in rows
        ]

    def stats(self) -> dict:
        with self._conn() as con:
            total = con.execute("SELECT COUNT(*) c FROM observations").fetchone()["c"]
            species = con.execute(
                "SELECT COUNT(DISTINCT lower(species)) c FROM observations"
            ).fetchone()["c"]
            week = con.execute(
                "SELECT COUNT(*) c FROM observations WHERE created_at >= now() - interval '7 days'"
            ).fetchone()["c"]
            rows = con.execute("SELECT created_at FROM observations").fetchall()
            top = con.execute(
                "SELECT species, COUNT(*) c FROM observations "
                "GROUP BY lower(species) ORDER BY c DESC LIMIT 5"
            ).fetchall()
        return {
            "total": total,
            "species": species,
            "this_week": week,
            "streak_days": _streak([str(r["created_at"]) for r in rows]),
            "top_species": [{"species": r["species"], "count": r["c"]} for r in top],
        }

    def timeline(self, days: int = 30):
        with self._conn() as con:
            rows = con.execute(
                "SELECT date_trunc('day', created_at) d, COUNT(*) c FROM observations "
                "WHERE created_at >= now() - (%s || ' days')::interval "
                "GROUP BY 1 ORDER BY 1",
                (days,),
            ).fetchall()
        counts = {str(r["d"])[:10]: r["c"] for r in rows}
        today = datetime.now(timezone.utc).date()
        return [
            {"date": (today - timedelta(days=i)).isoformat(), "count": counts.get((today - timedelta(days=i)).isoformat(), 0)}
            for i in range(days - 1, -1, -1)
        ]

    def species_in_season(self, month: int = None):
        month = month or datetime.now(timezone.utc).month
        with self._conn() as con:
            rows = con.execute(
                "SELECT species, COUNT(*) c FROM observations "
                "WHERE EXTRACT(MONTH FROM created_at) = %s GROUP BY species ORDER BY c DESC",
                (month,),
            ).fetchall()
        return [{"species": r["species"], "count": r["c"]} for r in rows]

    def context_for(self, limit: int = 40) -> str:
        observations = self.list_observations(limit=limit)
        lines = [
            f"- {str(o['created_at'])[:10]} | {o['species']} ({o['category']}, "
            f"conf {o['confidence']:.2f}) at {o.get('place') or 'unrecorded'}: {o.get('note')}"
            for o in observations
        ]
        return "\n".join(lines) if lines else "(the journal is empty)"


_store = None


def get_store():
    global _store
    if _store is not None:
        return _store
    url = config.DATABASE_URL
    if url.startswith("postgres"):
        try:
            _store = PostgresStore(url)
        except Exception:
            _store = SQLiteStore(config.SQLITE_PATH)
    else:
        _store = SQLiteStore(config.SQLITE_PATH)
    _store.init()
    return _store
