// === Multiplayer — Server connection, auth, cosmic war state ===
'use strict';

import { gameMode } from './state.js';

// --- Multiplayer state ---
export const mp = {
  user: null,           // { id, displayName, avatar } or null
  connected: false,
  socket: null,
  cosmicWar: { totalLight: 0, totalDark: 0 },
  online: { total: 0, light: 0, dark: 0 },
  pendingLumens: 0,     // Lumens earned since last report
};

// --- Callbacks for UI updates ---
const listeners = [];
export function onMultiplayerUpdate(fn) { listeners.push(fn); }
function notify() { listeners.forEach(fn => fn(mp)); }

// --- Auth ---
export async function fetchUser() {
  try {
    const res = await fetch('/auth/me');
    const data = await res.json();
    mp.user = data;
    notify();
  } catch (_) {
    mp.user = null;
  }
}

export async function logout() {
  try {
    await fetch('/auth/logout', { method: 'POST' });
    mp.user = null;
    notify();
  } catch (_) {}
}

// --- Cosmic War (REST fallback for initial load) ---
export async function fetchCosmicWar() {
  try {
    const res = await fetch('/api/cosmic-war');
    const data = await res.json();
    mp.cosmicWar.totalLight = data.totalLight || 0;
    mp.cosmicWar.totalDark = data.totalDark || 0;
    notify();
  } catch (_) {}
}

// --- Socket.io connection ---
export function connectSocket() {
  // Socket.io is loaded from the server (auto-served by socket.io)
  if (typeof io === 'undefined') return;

  const socket = io();
  mp.socket = socket;

  socket.on('connect', () => {
    mp.connected = true;
    // Join with current game mode
    if (gameMode) {
      socket.emit('join', { side: gameMode });
    }
    notify();
  });

  socket.on('disconnect', () => {
    mp.connected = false;
    notify();
  });

  socket.on('cosmic-war', (data) => {
    mp.cosmicWar.totalLight = data.totalLight;
    mp.cosmicWar.totalDark = data.totalDark;
    notify();
  });

  socket.on('online', (data) => {
    mp.online = data;
    notify();
  });
}

// --- Report earned lumens to the server ---
export function reportLumens(amount) {
  mp.pendingLumens += amount;
}

// Flush pending lumens every 10 seconds (batched to reduce traffic)
const REPORT_INTERVAL = 10000;

function flushLumens() {
  if (mp.pendingLumens > 0 && mp.socket && mp.connected && mp.user) {
    mp.socket.emit('contribute', { amount: Math.floor(mp.pendingLumens) });
    mp.pendingLumens = 0;
  }
}

// --- Notify server of side change ---
export function notifySideChange(side) {
  if (mp.socket && mp.connected) {
    mp.socket.emit('switch-side', { side });
  }
}

// --- Init (called once from main.js) ---
export async function initMultiplayer() {
  await fetchUser();
  await fetchCosmicWar();
  connectSocket();
  setInterval(flushLumens, REPORT_INTERVAL);
}
