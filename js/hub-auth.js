// === HubAuth — Shared neufmois.app login (lazy, failure-safe wrapper) ===
'use strict';

// The hub serves a browser module exposing getUser/getProfile/login/logout/getAccessToken/onAuthChange.
// Its session cookie lives on .neufmois.app: outside *.neufmois.app the player simply appears logged out.
export const HUB_AUTH_URL = 'https://neufmois.app/hub/auth.js';
const LOAD_TIMEOUT_MS = 8000;

let hubPromise = null;

// --- Race a promise against a timeout (resolves to `fallback` on timeout) ---
export function withTimeout(promise, ms, fallback) {
  return new Promise(function (resolve) {
    let done = false;
    const timer = setTimeout(function () {
      if (done) return;
      done = true;
      resolve(fallback);
    }, ms);
    Promise.resolve(promise).then(
      function (value) {
        if (done) return;
        done = true;
        clearTimeout(timer);
        resolve(value);
      },
      function () {
        if (done) return;
        done = true;
        clearTimeout(timer);
        resolve(fallback);
      },
    );
  });
}

// --- Build request headers carrying the access token (if any) ---
export function authHeaders(token, headers) {
  const out = Object.assign({}, headers || {});
  if (typeof token === 'string' && token.length > 0) {
    out.Authorization = 'Bearer ' + token;
  }
  return out;
}

// --- Load the hub module once; resolves to the module or null (offline, blocked, timeout) ---
export function loadHubAuth() {
  if (!hubPromise) {
    hubPromise = withTimeout(import(/* @vite-ignore */ HUB_AUTH_URL), LOAD_TIMEOUT_MS, null).then(function (mod) {
      return mod && typeof mod.getAccessToken === 'function' ? mod : null;
    });
  }
  return hubPromise;
}

// --- Current access token (JWT) or null ---
export async function getHubAccessToken() {
  const hub = await loadHubAuth();
  if (!hub) return null;
  try {
    const token = await withTimeout(hub.getAccessToken(), LOAD_TIMEOUT_MS, null);
    return typeof token === 'string' && token.length > 0 ? token : null;
  } catch (_) {
    return null;
  }
}

// --- Redirect to the hub login page (returns false if the hub is unreachable) ---
export async function hubLogin() {
  const hub = await loadHubAuth();
  if (!hub || typeof hub.login !== 'function') return false;
  try {
    await hub.login(window.location.href);
    return true;
  } catch (_) {
    return false;
  }
}

// --- Log out from the hub (shared session across *.neufmois.app) ---
export async function hubLogout() {
  const hub = await loadHubAuth();
  if (!hub || typeof hub.logout !== 'function') return;
  try {
    await hub.logout();
  } catch (_) {}
}

// --- Subscribe to login/logout events (no-op if the hub is unreachable) ---
export async function onHubAuthChange(fn) {
  const hub = await loadHubAuth();
  if (!hub || typeof hub.onAuthChange !== 'function') return;
  try {
    hub.onAuthChange(function () {
      fn();
    });
  } catch (_) {}
}
