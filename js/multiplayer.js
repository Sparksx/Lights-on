// === Multiplayer — Server connection, auth, cosmic war state, team production ===
'use strict';

import { gameMode } from './state.js';

// --- Multiplayer state ---
export const mp = {
  user: null, // { id, displayName, avatar } or null
  connected: false,
  socket: null,
  cosmicWar: { totalLight: 0, totalDark: 0 },
  online: { total: 0, light: 0, dark: 0 },
  pendingLumens: 0, // Lumens earned since last report

  // --- Team production ---
  contributionRate: 25, // % of lumens contributed (10, 25, 50, 100)
  profile: null, // { grade, contribution, side, season, streakDays, streakMultiplier, contributionRate, mpPrestigeBonus }

  // --- Season ---
  seasonInfo: {
    season: 0,
    remainingDays: 0,
    isLastDay: false,
    endsAt: null,
  },
  pendingRewards: [], // Unclaimed season rewards
  seasonEndData: null, // Set when a season-end event fires live
};

// --- Callbacks for UI updates ---
const listeners = [];
export function onMultiplayerUpdate(fn) {
  listeners.push(fn);
}
function notify() {
  listeners.forEach((fn) => fn(mp));
}

// --- Season end callbacks ---
const seasonEndListeners = [];
export function onSeasonEnd(fn) {
  seasonEndListeners.push(fn);
}

// --- Reward callbacks ---
const rewardListeners = [];
export function onRewardReceived(fn) {
  rewardListeners.push(fn);
}

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
    mp.profile = null;
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
    mp.seasonInfo.season = data.season || 0;
    mp.seasonInfo.remainingDays = data.remainingDays || 0;
    mp.seasonInfo.isLastDay = data.isLastDay || false;
    mp.seasonInfo.endsAt = data.endsAt || null;
    notify();
  } catch (_) {}
}

// --- Fetch player profile (grade, streak, etc.) ---
export async function fetchProfile() {
  try {
    const res = await fetch('/api/profile');
    const data = await res.json();
    if (data) {
      mp.profile = data;
      mp.contributionRate = data.contributionRate || 25;
      notify();
    }
  } catch (_) {}
}

// --- Fetch unclaimed rewards ---
export async function fetchRewards() {
  try {
    const res = await fetch('/api/rewards');
    const data = await res.json();
    if (Array.isArray(data) && data.length > 0) {
      mp.pendingRewards = data;
      rewardListeners.forEach((fn) => fn(data));
    }
  } catch (_) {}
}

// --- Set contribution rate ---
export function setContributionRate(rate) {
  const valid = [10, 25, 50, 100];
  if (!valid.includes(rate)) return;
  mp.contributionRate = rate;
  if (mp.socket && mp.connected) {
    mp.socket.emit('set-contribution-rate', { rate });
  }
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

  // --- New events ---

  // Server sends player profile updates (after contributions)
  socket.on('profile', (data) => {
    if (data) {
      mp.profile = data;
      mp.contributionRate = data.contributionRate || mp.contributionRate;
      notify();
    }
  });

  // Server sends unclaimed rewards on join
  socket.on('season-rewards', (data) => {
    if (Array.isArray(data) && data.length > 0) {
      mp.pendingRewards = data;
      rewardListeners.forEach((fn) => fn(data));
    }
  });

  // Server broadcasts season end
  socket.on('season-end', (data) => {
    mp.seasonEndData = data;
    seasonEndListeners.forEach((fn) => fn(data));
  });

  // Server confirms a reward was claimed
  socket.on('reward-claimed', (data) => {
    // Remove from pending
    mp.pendingRewards = mp.pendingRewards.filter((r) => r.id !== data.id);
    notify();
  });
}

// --- Report earned lumens to the server ---
export function reportLumens(amount) {
  mp.pendingLumens += amount;
}

// --- Get the effective contribution amount (applies rate) ---
export function getContributionAmount(lumens) {
  return Math.floor(lumens * (mp.contributionRate / 100));
}

// Flush pending lumens every 10 seconds (batched to reduce traffic)
const REPORT_INTERVAL = 10000;

function flushLumens() {
  if (mp.pendingLumens > 0 && mp.socket && mp.connected && mp.user) {
    var contributed = getContributionAmount(mp.pendingLumens);
    if (contributed > 0) {
      mp.socket.emit('contribute', { amount: contributed });
    }
    mp.pendingLumens = 0;
  }
}

// --- Claim a season reward ---
export function claimReward(rewardId) {
  if (mp.socket && mp.connected) {
    mp.socket.emit('claim-reward', { rewardId });
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
  if (mp.user) {
    await fetchProfile();
    await fetchRewards();
  }
  connectSocket();
  setInterval(flushLumens, REPORT_INTERVAL);
}
