// === Tests — shared neufmois.app login helpers (server/auth-utils.js + js/hub-auth.js) ===
import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';
import { authHeaders, withTimeout } from '../../js/hub-auth.js';

const require = createRequire(import.meta.url);
const {
  extractBearerToken,
  extractHandshakeToken,
  pickDisplayName,
  pickAvatarUrl,
  MAX_DISPLAY_NAME_LENGTH,
  DEFAULT_DISPLAY_NAME,
} = require('../../server/auth-utils.js');

describe('extractBearerToken', () => {
  it('extracts the token from a Bearer header', () => {
    expect(extractBearerToken('Bearer abc.def.ghi')).toBe('abc.def.ghi');
  });

  it('is case-insensitive on the scheme and tolerates extra spaces', () => {
    expect(extractBearerToken('  bearer   tok  ')).toBe('tok');
  });

  it('returns null for missing or malformed headers', () => {
    expect(extractBearerToken(undefined)).toBeNull();
    expect(extractBearerToken('')).toBeNull();
    expect(extractBearerToken('Basic abc')).toBeNull();
    expect(extractBearerToken('Bearer')).toBeNull();
    expect(extractBearerToken('Bearer a b')).toBeNull();
  });
});

describe('extractHandshakeToken', () => {
  it('reads auth.token', () => {
    expect(extractHandshakeToken({ token: 'jwt' })).toBe('jwt');
  });

  it('returns null for empty or invalid values', () => {
    expect(extractHandshakeToken(undefined)).toBeNull();
    expect(extractHandshakeToken({})).toBeNull();
    expect(extractHandshakeToken({ token: '   ' })).toBeNull();
    expect(extractHandshakeToken({ token: 42 })).toBeNull();
  });
});

describe('pickDisplayName', () => {
  it('prefers the hub profile display_name', () => {
    expect(pickDisplayName({ display_name: 'Cyprien' }, { user_metadata: { full_name: 'Other' } })).toBe('Cyprien');
  });

  it('falls back to JWT user_metadata names', () => {
    expect(pickDisplayName(null, { user_metadata: { full_name: 'Jane Doe' } })).toBe('Jane Doe');
    expect(pickDisplayName({ display_name: '  ' }, { user_metadata: { name: 'Nick' } })).toBe('Nick');
  });

  it('falls back to the email local part', () => {
    expect(pickDisplayName(null, { email: 'player@example.com' })).toBe('player');
  });

  it('returns the default name when nothing is available', () => {
    expect(pickDisplayName(null, {})).toBe(DEFAULT_DISPLAY_NAME);
    expect(pickDisplayName(null, null)).toBe(DEFAULT_DISPLAY_NAME);
  });

  it('trims and truncates to the column size', () => {
    const long = 'x'.repeat(300);
    expect(pickDisplayName({ display_name: long }, {})).toHaveLength(MAX_DISPLAY_NAME_LENGTH);
    expect(pickDisplayName({ display_name: '  Lumi  ' }, {})).toBe('Lumi');
  });
});

describe('pickAvatarUrl', () => {
  it('keeps http(s) URLs only', () => {
    expect(pickAvatarUrl({ avatar_url: 'https://cdn/a.png' }, {})).toBe('https://cdn/a.png');
    expect(pickAvatarUrl({ avatar_url: 'javascript:alert(1)' }, {})).toBeNull();
  });

  it('falls back to JWT metadata', () => {
    expect(pickAvatarUrl(null, { user_metadata: { picture: 'http://x/y.jpg' } })).toBe('http://x/y.jpg');
    expect(pickAvatarUrl(null, {})).toBeNull();
  });
});

describe('authHeaders', () => {
  it('adds a Bearer Authorization header when a token exists', () => {
    expect(authHeaders('tok')).toEqual({ Authorization: 'Bearer tok' });
  });

  it('keeps existing headers and does not mutate them', () => {
    const base = { 'Content-Type': 'application/json' };
    const out = authHeaders('tok', base);
    expect(out).toEqual({ 'Content-Type': 'application/json', Authorization: 'Bearer tok' });
    expect(base).toEqual({ 'Content-Type': 'application/json' });
  });

  it('adds nothing without a token', () => {
    expect(authHeaders(null)).toEqual({});
    expect(authHeaders('', { a: '1' })).toEqual({ a: '1' });
  });
});

describe('withTimeout', () => {
  it('resolves with the value when the promise settles in time', async () => {
    await expect(withTimeout(Promise.resolve(5), 100, null)).resolves.toBe(5);
  });

  it('resolves with the fallback on rejection', async () => {
    await expect(withTimeout(Promise.reject(new Error('offline')), 100, 'fb')).resolves.toBe('fb');
  });

  it('resolves with the fallback on timeout', async () => {
    await expect(withTimeout(new Promise(() => {}), 10, 'late')).resolves.toBe('late');
  });
});
