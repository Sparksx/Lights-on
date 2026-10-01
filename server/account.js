// === Account — GDPR account deletion requested by the neufmois.app hub ===
'use strict';

const { extractBearerToken } = require('./auth-utils');

// Origins allowed to call DELETE /api/account from a browser (the hub + local dev)
const ACCOUNT_ALLOWED_ORIGINS = ['https://neufmois.app', 'http://localhost:3000'];

/**
 * CORS for /api/account only: answers the preflight and decorates the DELETE.
 * The Allow-Origin header is only sent back for an allowed origin.
 */
function accountCors(req, res, next) {
  const origin = req.headers.origin;
  res.setHeader('Vary', 'Origin');
  if (typeof origin === 'string' && ACCOUNT_ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', 'DELETE');
    res.setHeader('Access-Control-Allow-Headers', 'Authorization');
  }
  if (req.method === 'OPTIONS') return res.status(204).end();
  next();
}

/**
 * Build the DELETE /api/account handler.
 * @param {object} deps
 * @param {(token: string) => Promise<object|null>} deps.verifyToken - returns the verified JWT payload or null
 * @param {(supabaseId: string) => Promise<string|null>} deps.deleteUser - deletes the row, returns the local user id (or null)
 * @param {(info: { sub: string, userId: string|null }) => void} [deps.onDeleted] - forget live state (cache, sockets)
 */
function createDeleteAccountHandler({ verifyToken, deleteUser, onDeleted }) {
  return async function deleteAccount(req, res) {
    const token = extractBearerToken(req.headers.authorization);
    if (!token) return res.status(401).json({ error: 'Not authenticated' });

    const payload = await verifyToken(token);
    if (!payload || typeof payload.sub !== 'string') return res.status(401).json({ error: 'Invalid token' });

    try {
      const userId = await deleteUser(payload.sub);
      if (onDeleted) {
        try {
          onDeleted({ sub: payload.sub, userId });
        } catch (err) {
          console.error('[api] account cleanup error:', err);
        }
      }
      console.log(`[api] account deleted (existed: ${userId ? 'yes' : 'no'})`);
      res.status(204).end();
    } catch (err) {
      console.error('[api] account deletion error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  };
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Delete a player's row (contributions and season rewards cascade). Kept here, free of `pg`,
 * so it can be unit-tested with a fake executor; db.js calls it with the pool.
 * @param {string} supabaseId - verified JWT `sub`
 * @param {{ query: Function }} db - query executor
 * @returns {Promise<string|null>} the deleted local user id, or null if no row existed
 */
async function deleteUserRow(supabaseId, db) {
  if (typeof supabaseId !== 'string' || !UUID_RE.test(supabaseId)) return null;
  const result = await db.query('DELETE FROM users WHERE supabase_id = $1 RETURNING id', [supabaseId]);
  return result.rows[0]?.id || null;
}

module.exports = { accountCors, createDeleteAccountHandler, deleteUserRow, ACCOUNT_ALLOWED_ORIGINS };
