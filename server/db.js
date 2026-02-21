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
  const existing = await pool.query(`SELECT * FROM users WHERE ${idColumn} = $1`, [profile.id]);

  if (existing.rows.length > 0) {
    // Update last seen
    await pool.query(`UPDATE users SET last_seen_at = NOW(), display_name = $1, avatar_url = $2 WHERE id = $3`, [
      profile.displayName,
      profile.avatar,
      existing.rows[0].id,
    ]);
    return existing.rows[0];
  }

  // Create new user
  const result = await pool.query(
    `INSERT INTO users (${idColumn}, display_name, avatar_url) VALUES ($1, $2, $3) RETURNING *`,
    [profile.id, profile.displayName, profile.avatar],
  );
  return result.rows[0];
}

/**
 * Get the current active season of the cosmic war.
 */
async function getCurrentSeason() {
  const result = await pool.query(`SELECT * FROM cosmic_war WHERE ended_at IS NULL ORDER BY season DESC LIMIT 1`);
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
    [Math.floor(amount)],
  );
  return result.rows[0] || null;
}

/**
 * Record a player's contribution (upsert — aggregates per user+season+side).
 * @param {string} userId
 * @param {number} seasonNum - Season number (passed by caller to avoid redundant query)
 * @param {string} side - 'on' or 'off'
 * @param {number} amount
 */
async function recordContribution(userId, seasonNum, side, amount) {
  await pool.query(
    `INSERT INTO contributions (user_id, season, game_mode, lumens_contributed)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (user_id, season, game_mode)
     DO UPDATE SET lumens_contributed = contributions.lumens_contributed + $4,
                   contributed_at = NOW()`,
    [userId, seasonNum, side, Math.floor(amount)],
  );
}

// --- Grade system ---
const GRADES_ON = [
  { name: 'Étincelle', threshold: 10000 },
  { name: 'Flamme', threshold: 100000 },
  { name: 'Étoile', threshold: 1000000 },
  { name: 'Nova', threshold: 10000000 },
  { name: 'Cosmos', threshold: 100000000 },
];

const GRADES_OFF = [
  { name: 'Murmure', threshold: 10000 },
  { name: 'Braise', threshold: 100000 },
  { name: 'Ombre', threshold: 1000000 },
  { name: 'Abîme', threshold: 10000000 },
  { name: 'Néant', threshold: 100000000 },
];

// Minimum contribution threshold to qualify for season rewards (grade index 1 = Flamme/Braise)
const REWARD_MIN_GRADE_INDEX = 1;

function computeGrade(totalContribution, side) {
  const grades = side === 'on' ? GRADES_ON : GRADES_OFF;
  let grade = 'none';
  for (const g of grades) {
    if (totalContribution >= g.threshold) grade = g.name;
  }
  return grade;
}

function gradeQualifiesForReward(grade, side) {
  const grades = side === 'on' ? GRADES_ON : GRADES_OFF;
  const gradeIndex = grades.findIndex((g) => g.name === grade);
  return gradeIndex >= REWARD_MIN_GRADE_INDEX;
}

/**
 * Get a player's total contribution for the current season.
 */
async function getPlayerSeasonContribution(userId) {
  const season = await getCurrentSeason();
  if (!season) return { total: 0, side: 'on', season: 0 };

  const result = await pool.query(
    `SELECT game_mode, COALESCE(SUM(lumens_contributed), 0) AS total
     FROM contributions
     WHERE user_id = $1 AND season = $2
     GROUP BY game_mode
     ORDER BY total DESC
     LIMIT 1`,
    [userId, season.season],
  );

  if (result.rows.length === 0) return { total: 0, side: 'on', season: season.season };
  return {
    total: Number(result.rows[0].total),
    side: result.rows[0].game_mode,
    season: season.season,
  };
}

/**
 * Get player's grade for the current season.
 */
async function getPlayerGrade(userId) {
  const { total, side, season } = await getPlayerSeasonContribution(userId);
  return {
    grade: computeGrade(total, side),
    contribution: total,
    side,
    season,
  };
}

/**
 * Update the player's daily streak.
 * Called on each contribution — increments if new day, resets if gap > 1 day.
 */
/**
 * Normalize a DATE column value (could be Date object or string) to 'YYYY-MM-DD'.
 */
function toDateString(val) {
  if (!val) return null;
  if (val instanceof Date) return val.toISOString().slice(0, 10);
  return String(val).slice(0, 10);
}

async function updateStreak(userId) {
  const result = await pool.query(`SELECT streak_days, streak_last_date FROM users WHERE id = $1`, [userId]);
  if (result.rows.length === 0) return 0;

  const user = result.rows[0];
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD (UTC)
  const lastDateStr = toDateString(user.streak_last_date);

  if (lastDateStr === today) {
    // Already contributed today (UTC)
    return user.streak_days;
  }

  let newStreak;
  if (lastDateStr) {
    const lastDate = new Date(lastDateStr + 'T00:00:00Z');
    const todayDate = new Date(today + 'T00:00:00Z');
    const diffDays = Math.round((todayDate - lastDate) / (1000 * 60 * 60 * 24));

    if (diffDays === 1) {
      // Consecutive day
      newStreak = Math.min((user.streak_days || 0) + 1, 11);
    } else {
      // Streak broken
      newStreak = 1;
    }
  } else {
    // First contribution ever
    newStreak = 1;
  }

  await pool.query(`UPDATE users SET streak_days = $1, streak_last_date = $2 WHERE id = $3`, [
    newStreak,
    today,
    userId,
  ]);

  return newStreak;
}

/**
 * Get streak multiplier (1.0 base + 0.1 per streak day, max 2.0).
 */
function getStreakMultiplier(streakDays) {
  return Math.min(1 + (streakDays - 1) * 0.1, 2.0);
}

/**
 * Get player's contribution rate setting.
 */
async function getPlayerContributionRate(userId) {
  const result = await pool.query(`SELECT contribution_rate FROM users WHERE id = $1`, [userId]);
  return result.rows[0]?.contribution_rate || 25;
}

/**
 * Set player's contribution rate.
 */
async function setPlayerContributionRate(userId, rate) {
  const validRates = [10, 25, 50, 100];
  if (!validRates.includes(rate)) return false;

  await pool.query(`UPDATE users SET contribution_rate = $1 WHERE id = $2`, [rate, userId]);
  return true;
}

/**
 * Get player's full multiplayer profile (grade, streak, contribution, prestige bonus).
 */
async function getPlayerProfile(userId) {
  const userResult = await pool.query(
    `SELECT streak_days, streak_last_date, contribution_rate, mp_prestige_bonus FROM users WHERE id = $1`,
    [userId],
  );
  if (userResult.rows.length === 0) return null;

  const user = userResult.rows[0];
  const gradeInfo = await getPlayerGrade(userId);

  // Check if streak is still active (contributed today or yesterday)
  let activeStreak = user.streak_days || 0;
  const lastDateStr = toDateString(user.streak_last_date);
  if (lastDateStr) {
    const today = new Date().toISOString().slice(0, 10);
    const lastDate = new Date(lastDateStr + 'T00:00:00Z');
    const todayDate = new Date(today + 'T00:00:00Z');
    const diffDays = Math.round((todayDate - lastDate) / (1000 * 60 * 60 * 24));
    if (diffDays > 1) activeStreak = 0; // Streak expired
  }

  return {
    grade: gradeInfo.grade,
    contribution: gradeInfo.contribution,
    side: gradeInfo.side,
    season: gradeInfo.season,
    streakDays: activeStreak,
    streakMultiplier: activeStreak > 0 ? getStreakMultiplier(activeStreak) : 1.0,
    contributionRate: user.contribution_rate || 25,
    mpPrestigeBonus: Number(user.mp_prestige_bonus) || 0,
  };
}

/**
 * Get leaderboard for the current season.
 * Returns top 20 per side + player's own rank.
 */
async function getLeaderboard(userId) {
  const season = await getCurrentSeason();
  if (!season) return { light: [], dark: [], playerRank: null };

  // Top 20 for light side
  const lightResult = await pool.query(
    `SELECT u.display_name, u.avatar_url, c.total
     FROM (
       SELECT user_id, SUM(lumens_contributed) AS total
       FROM contributions
       WHERE season = $1 AND game_mode = 'on'
       GROUP BY user_id
     ) c
     JOIN users u ON u.id = c.user_id
     ORDER BY c.total DESC
     LIMIT 20`,
    [season.season],
  );

  // Top 20 for dark side
  const darkResult = await pool.query(
    `SELECT u.display_name, u.avatar_url, c.total
     FROM (
       SELECT user_id, SUM(lumens_contributed) AS total
       FROM contributions
       WHERE season = $1 AND game_mode = 'off'
       GROUP BY user_id
     ) c
     JOIN users u ON u.id = c.user_id
     ORDER BY c.total DESC
     LIMIT 20`,
    [season.season],
  );

  // Player's own rank (if logged in)
  let playerRank = null;
  if (userId) {
    const { total, side } = await getPlayerSeasonContribution(userId);
    if (total > 0) {
      const rankResult = await pool.query(
        `SELECT COUNT(*) + 1 AS rank
         FROM (
           SELECT user_id, SUM(lumens_contributed) AS total
           FROM contributions
           WHERE season = $1 AND game_mode = $2
           GROUP BY user_id
           HAVING SUM(lumens_contributed) > $3
         ) r`,
        [season.season, side, total],
      );
      playerRank = {
        rank: Number(rankResult.rows[0]?.rank || 1),
        total,
        side,
      };
    }
  }

  return {
    season: season.season,
    light: lightResult.rows.map((r, i) => ({
      rank: i + 1,
      name: r.display_name,
      avatar: r.avatar_url,
      total: Number(r.total),
    })),
    dark: darkResult.rows.map((r, i) => ({
      rank: i + 1,
      name: r.display_name,
      avatar: r.avatar_url,
      total: Number(r.total),
    })),
    playerRank,
  };
}

// --- Season lifecycle ---

/**
 * Check if the current season should end, and if so, process it.
 * Returns the new season data if a transition happened, null otherwise.
 */
async function checkAndEndSeason() {
  const season = await getCurrentSeason();
  if (!season) return null;

  const durationMs = (season.duration_days || 14) * 24 * 60 * 60 * 1000;
  const startedAt = new Date(season.started_at).getTime();
  const now = Date.now();

  if (now - startedAt < durationMs) return null;

  console.log(`[db] Season ${season.season} ending...`);

  // Determine winner
  const totalLight = Number(season.total_light);
  const totalDark = Number(season.total_dark);
  let winner;
  if (totalLight > totalDark) winner = 'light';
  else if (totalDark > totalLight) winner = 'dark';
  else winner = 'draw';

  // Close the season
  await pool.query(`UPDATE cosmic_war SET ended_at = NOW(), winner = $1 WHERE id = $2`, [winner, season.id]);

  // Generate rewards for all contributing players
  await generateSeasonRewards(season.season, winner);

  // Create the next season (ON CONFLICT prevents duplicates from concurrent checks)
  const nextSeason = season.season + 1;
  await pool.query(`INSERT INTO cosmic_war (season) VALUES ($1) ON CONFLICT (season) DO NOTHING`, [nextSeason]);

  console.log(`[db] Season ${nextSeason} started. Previous winner: ${winner}`);

  return {
    endedSeason: season.season,
    winner,
    totalLight,
    totalDark,
    newSeason: nextSeason,
  };
}

/**
 * Generate rewards for all players who contributed to the ended season.
 */
async function generateSeasonRewards(seasonNum, winner) {
  // Get all contributors with their totals and main side
  const contributors = await pool.query(
    `SELECT user_id, game_mode,
            SUM(lumens_contributed) AS total
     FROM contributions
     WHERE season = $1
     GROUP BY user_id, game_mode
     ORDER BY total DESC`,
    [seasonNum],
  );

  // Group by side to compute ranks
  const bySide = { on: [], off: [] };
  for (const row of contributors.rows) {
    bySide[row.game_mode]?.push({
      userId: row.user_id,
      total: Number(row.total),
    });
  }

  // Sort each side by contribution (already sorted but re-ensure)
  bySide.on.sort((a, b) => b.total - a.total);
  bySide.off.sort((a, b) => b.total - a.total);

  const winningSide = winner === 'light' ? 'on' : winner === 'dark' ? 'off' : null;

  for (const side of ['on', 'off']) {
    const players = bySide[side];
    const teamSize = players.length;
    const topTenCutoff = Math.max(1, Math.ceil(teamSize * 0.1));

    for (let i = 0; i < players.length; i++) {
      const p = players[i];
      const grade = computeGrade(p.total, side);
      const rank = i + 1;
      const isTopPercent = rank <= topTenCutoff;

      const qualifies = gradeQualifiesForReward(grade, side);

      let won = false;
      let prestigeBonus = 0;

      if (qualifies) {
        if (winner === 'draw') {
          prestigeBonus = 0.05;
        } else if (winningSide === side) {
          won = true;
          prestigeBonus = 0.1;
        } else {
          prestigeBonus = 0.02;
        }
        if (isTopPercent) {
          prestigeBonus += 0.1;
        }
      }

      // Insert reward record
      await pool.query(
        `INSERT INTO season_rewards (user_id, season, side, contribution_total, rank_in_team, grade, won, top_percent, prestige_bonus)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [p.userId, seasonNum, side, p.total, rank, grade, won, isTopPercent, prestigeBonus],
      );

      // Apply prestige bonus to user's permanent bonus
      if (prestigeBonus > 0) {
        await pool.query(`UPDATE users SET mp_prestige_bonus = mp_prestige_bonus + $1 WHERE id = $2`, [
          prestigeBonus,
          p.userId,
        ]);
      }
    }
  }

  console.log(
    `[db] Generated rewards for season ${seasonNum}: ${bySide.on.length} light + ${bySide.off.length} dark players`,
  );
}

/**
 * Get unclaimed rewards for a player.
 */
async function getUnclaimedRewards(userId) {
  const result = await pool.query(
    `SELECT sr.*, cw.total_light, cw.total_dark, cw.winner
     FROM season_rewards sr
     JOIN cosmic_war cw ON cw.season = sr.season
     WHERE sr.user_id = $1 AND sr.claimed = FALSE
     ORDER BY sr.season DESC`,
    [userId],
  );
  return result.rows;
}

/**
 * Claim a season reward.
 */
async function claimReward(userId, rewardId) {
  const result = await pool.query(
    `UPDATE season_rewards SET claimed = TRUE
     WHERE id = $1 AND user_id = $2 AND claimed = FALSE
     RETURNING *`,
    [rewardId, userId],
  );
  return result.rows[0] || null;
}

/**
 * Get season info including time remaining.
 */
async function getSeasonInfo() {
  const season = await getCurrentSeason();
  if (!season) return null;

  const durationMs = (season.duration_days || 14) * 24 * 60 * 60 * 1000;
  const startedAt = new Date(season.started_at).getTime();
  const endsAt = startedAt + durationMs;
  const remaining = Math.max(0, endsAt - Date.now());

  return {
    season: season.season,
    totalLight: Number(season.total_light),
    totalDark: Number(season.total_dark),
    startedAt: season.started_at,
    endsAt: new Date(endsAt).toISOString(),
    remainingMs: remaining,
    remainingDays: Math.ceil(remaining / (1000 * 60 * 60 * 24)),
    isLastDay: remaining < 24 * 60 * 60 * 1000,
  };
}

module.exports = {
  pool,
  initDB,
  findOrCreateUser,
  getCurrentSeason,
  addToCosmicWar,
  recordContribution,
  getPlayerProfile,
  getPlayerGrade,
  updateStreak,
  getStreakMultiplier,
  getPlayerContributionRate,
  setPlayerContributionRate,
  getLeaderboard,
  checkAndEndSeason,
  getUnclaimedRewards,
  claimReward,
  getSeasonInfo,
  GRADES_ON,
  GRADES_OFF,
};
