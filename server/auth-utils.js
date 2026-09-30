// === Auth utils — Pure helpers for the shared neufmois.app login ===
'use strict';

const MAX_DISPLAY_NAME_LENGTH = 100; // users.display_name is VARCHAR(100)
const DEFAULT_DISPLAY_NAME = 'Joueur';

/**
 * Extract a bearer token from an `Authorization` header value.
 * @param {string|undefined} header
 * @returns {string|null}
 */
function extractBearerToken(header) {
  if (typeof header !== 'string') return null;
  const match = /^Bearer\s+(\S+)\s*$/i.exec(header.trim());
  return match ? match[1] : null;
}

/**
 * Normalize a token coming from the Socket.io handshake (`auth: { token }`).
 * @param {unknown} auth
 * @returns {string|null}
 */
function extractHandshakeToken(auth) {
  const token = auth && typeof auth === 'object' ? auth.token : null;
  if (typeof token !== 'string') return null;
  const trimmed = token.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Pick a trusted display name for a player.
 * Priority: hub profile display_name > JWT user_metadata name > email local part > default.
 * @param {{ display_name?: string }|null} profile - row from the hub `profiles` table
 * @param {object} payload - verified JWT payload
 * @returns {string}
 */
function pickDisplayName(profile, payload) {
  const meta = (payload && payload.user_metadata) || {};
  const email = payload && typeof payload.email === 'string' ? payload.email : '';
  const candidates = [
    profile && profile.display_name,
    meta.display_name,
    meta.full_name,
    meta.name,
    email.includes('@') ? email.split('@')[0] : '',
  ];
  for (const c of candidates) {
    if (typeof c === 'string' && c.trim().length > 0) {
      return c.trim().slice(0, MAX_DISPLAY_NAME_LENGTH);
    }
  }
  return DEFAULT_DISPLAY_NAME;
}

/**
 * Pick an avatar URL (only http(s) URLs are kept).
 * @param {{ avatar_url?: string }|null} profile
 * @param {object} payload
 * @returns {string|null}
 */
function pickAvatarUrl(profile, payload) {
  const meta = (payload && payload.user_metadata) || {};
  const candidates = [profile && profile.avatar_url, meta.avatar_url, meta.picture];
  for (const c of candidates) {
    if (typeof c === 'string' && /^https?:\/\//i.test(c)) return c;
  }
  return null;
}

module.exports = {
  extractBearerToken,
  extractHandshakeToken,
  pickDisplayName,
  pickAvatarUrl,
  MAX_DISPLAY_NAME_LENGTH,
  DEFAULT_DISPLAY_NAME,
};
