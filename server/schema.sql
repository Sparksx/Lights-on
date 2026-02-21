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
  last_seen_at TIMESTAMPTZ DEFAULT NOW(),
  -- Multiplayer progression
  contribution_rate INT DEFAULT 25 CHECK (contribution_rate IN (10, 25, 50, 100)),
  streak_days INT DEFAULT 0,
  streak_last_date DATE,
  mp_prestige_bonus NUMERIC(6,2) DEFAULT 0
);

-- Cosmic War — one row per active season
CREATE TABLE IF NOT EXISTS cosmic_war (
  id SERIAL PRIMARY KEY,
  season INT NOT NULL DEFAULT 1 UNIQUE,
  total_light BIGINT DEFAULT 0,
  total_dark BIGINT DEFAULT 0,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  duration_days INT DEFAULT 14,
  winner VARCHAR(5) CHECK (winner IN ('light', 'dark', 'draw'))
);

-- Seed the first season
INSERT INTO cosmic_war (season) VALUES (1)
  ON CONFLICT (season) DO NOTHING;

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

-- Season rewards — generated at season end for each qualifying player
CREATE TABLE IF NOT EXISTS season_rewards (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  season INT NOT NULL,
  side VARCHAR(3) NOT NULL CHECK (side IN ('on', 'off')),
  contribution_total BIGINT DEFAULT 0,
  rank_in_team INT,
  grade VARCHAR(20) NOT NULL DEFAULT 'none',
  won BOOLEAN DEFAULT FALSE,
  top_percent BOOLEAN DEFAULT FALSE,
  prestige_bonus NUMERIC(4,2) DEFAULT 0,
  claimed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_season_rewards_user ON season_rewards(user_id);
CREATE INDEX IF NOT EXISTS idx_season_rewards_season ON season_rewards(season);

-- Unique index for contribution aggregation (upsert per user+season+side)
CREATE UNIQUE INDEX IF NOT EXISTS idx_contributions_user_season_mode
  ON contributions(user_id, season, game_mode);

-- Migrations: add columns if they don't exist (safe for existing databases)
DO $$ BEGIN
  ALTER TABLE users ADD COLUMN IF NOT EXISTS contribution_rate INT DEFAULT 25;
  ALTER TABLE users ADD COLUMN IF NOT EXISTS streak_days INT DEFAULT 0;
  ALTER TABLE users ADD COLUMN IF NOT EXISTS streak_last_date DATE;
  ALTER TABLE users ADD COLUMN IF NOT EXISTS mp_prestige_bonus NUMERIC(6,2) DEFAULT 0;
  ALTER TABLE cosmic_war ADD COLUMN IF NOT EXISTS duration_days INT DEFAULT 14;
  ALTER TABLE cosmic_war ADD COLUMN IF NOT EXISTS winner VARCHAR(5);
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Add UNIQUE constraint on cosmic_war.season for existing databases
DO $$ BEGIN
  ALTER TABLE cosmic_war ADD CONSTRAINT cosmic_war_season_unique UNIQUE (season);
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
