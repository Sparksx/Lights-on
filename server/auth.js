// === Auth — Shared neufmois.app login (Supabase JWT verification) ===
'use strict';

const { findOrCreateUserBySupabaseId } = require('./db');
const { extractBearerToken, extractHandshakeToken, pickDisplayName, pickAvatarUrl } = require('./auth-utils');

// --- Hub (neufmois.app) Supabase project — public values, no secret needed ---
const SUPABASE_URL = 'https://cvjkclypgvnrblmnxita.supabase.co';
const ISSUER = `${SUPABASE_URL}/auth/v1`;
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_Ln1QCp29w3UTkJn5VHMnuA_Gp2_MxSk';

const PROFILE_TIMEOUT_MS = 5000;
const USER_CACHE_TTL_MS = 5 * 60 * 1000; // re-sync display name at most every 5 min per player

// --- JWT verification (jose is ESM-only → lazy dynamic import) ---
let verifierPromise = null;

function getVerifier() {
  if (!verifierPromise) {
    verifierPromise = import('jose')
      .then(({ createRemoteJWKSet, jwtVerify }) => {
        const JWKS = createRemoteJWKSet(new URL(`${ISSUER}/.well-known/jwks.json`));
        return (token) => jwtVerify(token, JWKS, { issuer: ISSUER, audience: 'authenticated' });
      })
      .catch((err) => {
        verifierPromise = null; // allow retry
        throw err;
      });
  }
  return verifierPromise;
}

/**
 * Verify a hub access token.
 * @param {string} token
 * @returns {Promise<object|null>} verified payload, or null if invalid
 */
async function verifyToken(token) {
  if (!token) return null;
  try {
    const verify = await getVerifier();
    const { payload } = await verify(token);
    return payload && typeof payload.sub === 'string' ? payload : null;
  } catch (_) {
    return null;
  }
}

/**
 * Fetch the player's own hub profile (RLS: a player can only read their own row).
 * @returns {Promise<{display_name?: string, avatar_url?: string}|null>}
 */
async function fetchHubProfile(sub, token) {
  try {
    const url = `${SUPABASE_URL}/rest/v1/profiles?id=eq.${encodeURIComponent(sub)}&select=display_name,avatar_url`;
    const res = await fetch(url, {
      headers: { apikey: SUPABASE_PUBLISHABLE_KEY, Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(PROFILE_TIMEOUT_MS),
    });
    if (!res.ok) return null;
    const rows = await res.json();
    return Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
  } catch (err) {
    console.error('[auth] profile fetch failed:', err.message);
    return null;
  }
}

// --- sub -> { user, expiresAt } cache (avoids a DB + REST round-trip per request) ---
const userCache = new Map();

/**
 * Resolve a hub access token to a local `users` row.
 * Returns null when the token is missing/invalid or the database is unavailable.
 * @param {string|null} token
 * @returns {Promise<{id: string, display_name: string, avatar_url: string|null}|null>}
 */
async function authenticate(token) {
  const payload = await verifyToken(token);
  if (!payload) return null;

  const cached = userCache.get(payload.sub);
  if (cached && cached.expiresAt > Date.now()) return cached.user;

  try {
    const profile = await fetchHubProfile(payload.sub, token);
    const user = await findOrCreateUserBySupabaseId(payload.sub, {
      displayName: pickDisplayName(profile, payload),
      avatar: pickAvatarUrl(profile, payload),
    });
    if (!user) return null;
    const slim = { id: user.id, display_name: user.display_name, avatar_url: user.avatar_url };
    userCache.set(payload.sub, { user: slim, expiresAt: Date.now() + USER_CACHE_TTL_MS });
    return slim;
  } catch (err) {
    console.error('[auth] user sync failed:', err.message);
    return null;
  }
}

// --- Express middleware: sets req.user from `Authorization: Bearer <token>` ---
function authMiddleware(req, _res, next) {
  const token = extractBearerToken(req.headers.authorization);
  if (!token) {
    req.user = null;
    return next();
  }
  authenticate(token)
    .then((user) => {
      req.user = user;
      next();
    })
    .catch(() => {
      req.user = null;
      next();
    });
}

// --- Socket.io middleware: sets socket.data.user from handshake `auth: { token }` ---
// Never rejects the connection: anonymous players still see the cosmic war.
function socketAuthMiddleware(socket, next) {
  const token = extractHandshakeToken(socket.handshake.auth);
  if (!token) {
    socket.data.user = null;
    return next();
  }
  authenticate(token)
    .then((user) => {
      socket.data.user = user;
      next();
    })
    .catch(() => {
      socket.data.user = null;
      next();
    });
}

// --- Auth routes ---
function setupAuthRoutes(app) {
  // Current user (resolved from the bearer token)
  app.get('/auth/me', authMiddleware, (req, res) => {
    if (!req.user) return res.json(null);
    res.json({
      id: req.user.id,
      displayName: req.user.display_name,
      avatar: req.user.avatar_url,
    });
  });
}

/**
 * Forget a player's cached identity (e.g. after account deletion).
 * @param {string} sub
 */
function forgetUser(sub) {
  userCache.delete(sub);
}

module.exports = {
  authenticate,
  verifyToken,
  forgetUser,
  authMiddleware,
  socketAuthMiddleware,
  setupAuthRoutes,
  ISSUER,
};
