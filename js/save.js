// === Save / Load — Persistence to localStorage ===
'use strict';

import { state, shared, getSaveKey } from './state.js';
import { _now } from './utils.js';

export function save() {
  const data = {
    lumens: state.lumens,
    totalLumens: state.totalLumens,
    clickPower: state.clickPower,
    upgrades: state.upgrades,
    victoryReached: state.victoryReached,
    sunPurchased: state.sunPurchased,
    acPenaltyCount: shared.acPenaltyCount,
    lastSaveTime: _now(),
  };
  try {
    localStorage.setItem(getSaveKey(), JSON.stringify(data));
  } catch (_) {
    // silently fail if storage unavailable
  }
}

export function load() {
  try {
    const raw = localStorage.getItem(getSaveKey());
    if (!raw) return null;
    const data = JSON.parse(raw);
    state.lumens = data.lumens || 0;
    state.totalLumens = data.totalLumens || 0;
    state.clickPower = data.clickPower || 1;
    state.upgrades = data.upgrades || {};
    state.victoryReached = data.victoryReached || false;
    state.sunPurchased = data.sunPurchased || false;
    shared.acPenaltyCount = data.acPenaltyCount || 0;
    return data;
  } catch (_) {
    // corrupted save, ignore
    return null;
  }
}
