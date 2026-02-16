'use strict';

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

/**
 * Run the schema.sql file to ensure all tables exist.
 */
async function initDB() {
  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  await pool.query(schema);
  console.log('[db] Schema initialized');
}

/**
 * Find or create a user from an OAuth profile.
 * @param {string} provider - 'google' or 'discord'
 * @param {object} profile - { id, displayName, avatar }
 * @returns {object} user row
 */
async function findOrCreateUser(provider, profile) {
  const idColumn = provider === 'google' ? 'google_id' : 'discord_id';

  // Try to find existing user
  const existing = await pool.query(
    `SELECT * FROM users WHERE ${idColumn} = $1`,
    [profile.id]
  );

  if (existing.rows.length > 0) {
    // Update last seen
    await pool.query(
      `UPDATE users SET last_seen_at = NOW(), display_name = $1, avatar_url = $2 WHERE id = $3`,
      [profile.displayName, profile.avatar, existing.rows[0].id]
    );
    return existing.rows[0];
  }

  // Create new user
  const result = await pool.query(
    `INSERT INTO users (${idColumn}, display_name, avatar_url) VALUES ($1, $2, $3) RETURNING *`,
    [profile.id, profile.displayName, profile.avatar]
  );
  return result.rows[0];
}

/**
 * Get the current active season of the cosmic war.
 */
async function getCurrentSeason() {
  const result = await pool.query(
    `SELECT * FROM cosmic_war WHERE ended_at IS NULL ORDER BY season DESC LIMIT 1`
  );
  return result.rows[0] || null;
}

/**
 * Add lumens to the cosmic war for a given side.
 * @param {'on'|'off'} side
 * @param {number} amount
 */
async function addToCosmicWar(side, amount) {
  const column = side === 'on' ? 'total_light' : 'total_dark';
  const result = await pool.query(
    `UPDATE cosmic_war SET ${column} = ${column} + $1
     WHERE ended_at IS NULL
     RETURNING total_light, total_dark`,
    [Math.floor(amount)]
  );
  return result.rows[0] || null;
}

/**
 * Record a player's contribution.
 */
async function recordContribution(userId, gameMode, amount) {
  const season = await getCurrentSeason();
  if (!season) return;

  await pool.query(
    `INSERT INTO contributions (user_id, season, game_mode, lumens_contributed)
     VALUES ($1, $2, $3, $4)`,
    [userId, season.season, gameMode, Math.floor(amount)]
  );
}

module.exports = {
  pool,
  initDB,
  findOrCreateUser,
  getCurrentSeason,
  addToCosmicWar,
  recordContribution,
};
