-- Bioledger schema for TimescaleDB + pgvector (Tiger Cloud or local TimescaleDB).
-- This is the scalable twin of the SQLite default store.

CREATE EXTENSION IF NOT EXISTS timescaledb;
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS observations (
    id          BIGSERIAL PRIMARY KEY,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    text        TEXT NOT NULL,
    place       TEXT,
    lat         DOUBLE PRECISION,
    lon         DOUBLE PRECISION,
    species     TEXT,
    common_name TEXT,
    category    TEXT,
    confidence  DOUBLE PRECISION,
    note        TEXT,
    tags        TEXT[],
    season_note TEXT,
    embedding   vector(768),
    source      TEXT DEFAULT 'user'
);

ALTER TABLE observations ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'user';

-- Time-series hypertable: every sighting is a point in time.
SELECT create_hypertable('observations', 'created_at', if_not_exists => TRUE, migrate_data => TRUE);

CREATE INDEX IF NOT EXISTS observations_created_idx ON observations (created_at DESC);
CREATE INDEX IF NOT EXISTS observations_species_idx ON observations (lower(species));
CREATE INDEX IF NOT EXISTS observations_embedding_idx ON observations USING hnsw (embedding vector_cosine_ops);

-- Continuous aggregate: "what is in season" refreshed automatically.
CREATE MATERIALIZED VIEW IF NOT EXISTS obs_weekly
WITH (timescaledb.continuous) AS
SELECT
    time_bucket('7 days', created_at) AS week,
    species,
    COUNT(*)            AS sightings,
    AVG(confidence)     AS avg_confidence
FROM observations
GROUP BY week, species
WITH NO DATA;

SELECT add_continuous_aggregate_policy('obs_weekly',
    start_offset      => INTERVAL '90 days',
    end_offset        => INTERVAL '1 hour',
    schedule_interval => INTERVAL '1 day',
    if_not_exists     => TRUE);
