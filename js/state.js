// === State — Core game state, mode, prestige, shared flags ===
'use strict';

// --- Prestige ---
export let prestigeLevel = 0;
export let prestigeMultiplier = 1;
export const PRESTIGE_SAVE_KEY = 'light-prestige';

export function setPrestigeLevel(val) { prestigeLevel = val; }
export function setPrestigeMultiplier(val) { prestigeMultiplier = val; }

export function loadPrestige() {
  try {
    var raw = localStorage.getItem(PRESTIGE_SAVE_KEY);
    if (!raw) return;
    var data = JSON.parse(raw);
    prestigeLevel = data.level || 0;
    prestigeMultiplier = 1 + prestigeLevel * 0.5;
  } catch(_) {}
}

export function savePrestige() {
  try {
    localStorage.setItem(PRESTIGE_SAVE_KEY, JSON.stringify({ level: prestigeLevel }));
  } catch(_) {}
}

loadPrestige();

// --- Game Mode ---
// 'on' = classic (dark→light), 'off' = inverted (light→dark)
export let gameMode = null;
export let gameStarted = false;

export function setGameMode(mode) { gameMode = mode; }
export function setGameStarted(val) { gameStarted = val; }

// --- State ---
export const state = {
  lumens: 0,
  totalLumens: 0,
  clickPower: 1,
  lumensPerSecond: 0,
  upgrades: {},
  victoryReached: false,
  sunPurchased: false,
};

// --- Constants ---
export const VICTORY_LUMENS = 1000000000000;

export function getSaveKey() {
  return gameMode === 'off' ? 'lights-off-save' : 'lights-on-save';
}

// --- Multiplayer prestige bonus (permanent, from season rewards) ---
export let mpPrestigeBonus = 0;

export function setMpPrestigeBonus(val) { mpPrestigeBonus = val; }

export function getTotalPrestigeMultiplier() {
  return prestigeMultiplier + mpPrestigeBonus;
}

// --- Shared mutable flags (cross-module) ---
export const shared = {
  sunCinematicActive: false,
  sunCinematicProgress: 0,
  mouseX: 0,
  mouseY: 0,
  adminMode: false,
  pendingReward: false,
  acPenaltyCount: 0,
};

// --- Utility ---
export function getUpgradeCount(id) {
  return state.upgrades[id] || 0;
}
