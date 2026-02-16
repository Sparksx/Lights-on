-- Lights-on Multiplayer Schema

-- Session store for express-session (connect-pg-simple)
CREATE TABLE IF NOT EXISTS "session" (
  "sid" VARCHAR NOT NULL PRIMARY KEY,
  "sess" JSON NOT NULL,
  "expire" TIMESTAMP(6) NOT NULL
);
CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON "session" ("expire");

-- Players
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  google_id VARCHAR(255) UNIQUE,
  discord_id VARCHAR(255) UNIQUE,
  display_name VARCHAR(100) NOT NULL,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ DEFAULT NOW()
);

-- Cosmic War — one row per active season
CREATE TABLE IF NOT EXISTS cosmic_war (
  id SERIAL PRIMARY KEY,
  season INT NOT NULL DEFAULT 1,
  total_light BIGINT DEFAULT 0,
  total_dark BIGINT DEFAULT 0,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  ended_at TIMESTAMPTZ
);

-- Seed the first season
INSERT INTO cosmic_war (season) VALUES (1)
  ON CONFLICT DO NOTHING;

-- Per-player contributions to the current cosmic war
CREATE TABLE IF NOT EXISTS contributions (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  season INT NOT NULL DEFAULT 1,
  game_mode VARCHAR(3) NOT NULL CHECK (game_mode IN ('on', 'off')),
  lumens_contributed BIGINT DEFAULT 0,
  contributed_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_contributions_user ON contributions(user_id);
CREATE INDEX IF NOT EXISTS idx_contributions_season ON contributions(season);
