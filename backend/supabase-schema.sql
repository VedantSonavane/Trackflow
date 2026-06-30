-- TrackFlow v2 Schema
-- Run in Supabase SQL Editor (safe to re-run — uses IF NOT EXISTS / ADD COLUMN IF NOT EXISTS)

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── Users ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  created_at BIGINT DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT
);

-- ── Anonymous user identity ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users_anonymous (
  user_hash TEXT NOT NULL,
  site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  first_seen BIGINT NOT NULL,
  last_seen BIGINT NOT NULL,
  session_count INT DEFAULT 1,
  PRIMARY KEY (user_hash, site_id)
);

-- ── Sites ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sites (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  domain TEXT NOT NULL,
  api_key TEXT UNIQUE NOT NULL,
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at BIGINT DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT
);

-- ── Events ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS events (
  id SERIAL PRIMARY KEY,
  site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  client_id TEXT,
  session_id TEXT,
  user_hash TEXT,
  type TEXT NOT NULL,
  url TEXT,
  source TEXT DEFAULT 'direct',
  medium TEXT DEFAULT 'none',
  campaign TEXT DEFAULT '',
  payload JSONB,
  ts BIGINT DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT,
  is_conversion BOOLEAN DEFAULT FALSE,
  UNIQUE (site_id, client_id)
);

-- Add columns if upgrading existing install
ALTER TABLE events ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'direct';
ALTER TABLE events ADD COLUMN IF NOT EXISTS medium TEXT DEFAULT 'none';
ALTER TABLE events ADD COLUMN IF NOT EXISTS campaign TEXT DEFAULT '';
ALTER TABLE events ADD COLUMN IF NOT EXISTS is_conversion BOOLEAN DEFAULT FALSE;

-- ── Heatmap ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS heatmap_points (
  id SERIAL PRIMARY KEY,
  site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  x REAL NOT NULL,
  y REAL NOT NULL,
  type TEXT DEFAULT 'click',
  ts BIGINT DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT
);

-- ── Sessions ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT NOT NULL,
  site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  user_hash TEXT,
  started_at BIGINT NOT NULL,
  ended_at BIGINT,
  duration_s INT GENERATED ALWAYS AS (COALESCE(ended_at, started_at) - started_at) STORED,
  page_count INT DEFAULT 1,
  entry_url TEXT,
  referrer TEXT,
  source TEXT DEFAULT 'direct',
  medium TEXT DEFAULT 'none',
  campaign TEXT DEFAULT '',
  country TEXT,
  device_type TEXT,
  browser TEXT,
  os TEXT,
  PRIMARY KEY (site_id, id)
);

ALTER TABLE sessions ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'direct';
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS medium TEXT DEFAULT 'none';
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS campaign TEXT DEFAULT '';

-- ── Daily stats rollup ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS daily_stats (
  site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  day DATE NOT NULL,
  pageviews INT DEFAULT 0,
  sessions INT DEFAULT 0,
  clicks INT DEFAULT 0,
  rage_clicks INT DEFAULT 0,
  errors INT DEFAULT 0,
  avg_load_ms INT DEFAULT 0,
  PRIMARY KEY (site_id, day)
);

-- ── Conversion goals ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS conversion_goals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  event_type TEXT NOT NULL,      -- e.g. 'pageview', 'custom', 'form_submit'
  match_url TEXT,                -- optional URL pattern
  match_payload JSONB,           -- optional payload key/value match
  created_at BIGINT DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT
);

-- ── Retention cohorts ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS retention_cohorts (
  site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  cohort_week DATE NOT NULL,
  return_week DATE NOT NULL,
  user_count INT DEFAULT 0,
  PRIMARY KEY (site_id, cohort_week, return_week)
);

-- ── Sites: api_key_hash (Day 6 hashed-key migration) ───────────────────────
ALTER TABLE sites ADD COLUMN IF NOT EXISTS api_key_hash TEXT;
CREATE INDEX IF NOT EXISTS idx_sites_api_key_hash ON sites(api_key_hash);

-- ── Identified users (cross-device identity) ───────────────────────────────
CREATE TABLE IF NOT EXISTS users_identified (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  site_id UUID REFERENCES sites(id) ON DELETE CASCADE,
  user_hash TEXT NOT NULL,
  user_id TEXT,
  traits JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Ecommerce events ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ecommerce_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  session_id TEXT,
  user_hash TEXT,
  event TEXT NOT NULL,
  value NUMERIC,
  currency TEXT DEFAULT 'USD',
  items JSONB DEFAULT '[]'::jsonb,
  ts BIGINT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Segments ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS segments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  filters JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Failed events (dead-letter) ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS failed_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID,
  payload JSONB,
  error TEXT,
  failed_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Indexes ───────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_events_site_ts ON events(site_id, ts);
CREATE INDEX IF NOT EXISTS idx_events_type ON events(type);
CREATE INDEX IF NOT EXISTS idx_events_session ON events(session_id);
CREATE INDEX IF NOT EXISTS idx_events_source ON events(site_id, source);
CREATE INDEX IF NOT EXISTS idx_events_site_type_ts ON events(site_id, type, ts);
CREATE INDEX IF NOT EXISTS idx_heatmap_site_url ON heatmap_points(site_id, url);
CREATE INDEX IF NOT EXISTS idx_heatmap_site_url_ts ON heatmap_points(site_id, url, ts);
CREATE INDEX IF NOT EXISTS idx_sites_api_key ON sites(api_key);
CREATE INDEX IF NOT EXISTS idx_sites_user_id ON sites(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_site_started ON sessions(site_id, started_at);
CREATE INDEX IF NOT EXISTS idx_sessions_source ON sessions(site_id, source);
CREATE INDEX IF NOT EXISTS idx_daily_stats_site_day ON daily_stats(site_id, day);
CREATE INDEX IF NOT EXISTS idx_users_anon_site ON users_anonymous(site_id);
CREATE INDEX IF NOT EXISTS idx_users_anon_site_lastseen ON users_anonymous(site_id, last_seen);
CREATE INDEX IF NOT EXISTS idx_users_identified_site ON users_identified(site_id, user_hash);
CREATE INDEX IF NOT EXISTS idx_ecommerce_site_ts ON ecommerce_events(site_id, ts);
CREATE INDEX IF NOT EXISTS idx_segments_site ON segments(site_id);
CREATE INDEX IF NOT EXISTS idx_failed_events_site ON failed_events(site_id);

-- ── RPC: increment_daily_stats ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION increment_daily_stats(
  p_site_id UUID, p_day DATE,
  p_pageviews INT, p_sessions INT,
  p_clicks INT, p_rage_clicks INT, p_errors INT
) RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO daily_stats(site_id, day, pageviews, sessions, clicks, rage_clicks, errors)
  VALUES (p_site_id, p_day, p_pageviews, p_sessions, p_clicks, p_rage_clicks, p_errors)
  ON CONFLICT (site_id, day) DO UPDATE SET
    pageviews   = daily_stats.pageviews   + EXCLUDED.pageviews,
    sessions    = daily_stats.sessions    + EXCLUDED.sessions,
    clicks      = daily_stats.clicks      + EXCLUDED.clicks,
    rage_clicks = daily_stats.rage_clicks + EXCLUDED.rage_clicks,
    errors      = daily_stats.errors      + EXCLUDED.errors;
END;
$$;