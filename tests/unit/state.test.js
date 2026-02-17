// === Tests — state.js ===
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  state,
  shared,
  gameMode,
  gameStarted,
  setGameMode,
  setGameStarted,
  getSaveKey,
  getUpgradeCount,
  VICTORY_LUMENS,
  prestigeLevel,
  prestigeMultiplier,
  setPrestigeLevel,
  setPrestigeMultiplier,
  loadPrestige,
  savePrestige,
  PRESTIGE_SAVE_KEY,
} from '../../js/state.js';

describe('state object', () => {
  beforeEach(() => {
    state.lumens = 0;
    state.totalLumens = 0;
    state.clickPower = 1;
    state.lumensPerSecond = 0;
    state.upgrades = {};
    state.victoryReached = false;
    state.sunPurchased = false;
  });

  it('has correct initial values', () => {
    expect(state.lumens).toBe(0);
    expect(state.totalLumens).toBe(0);
    expect(state.clickPower).toBe(1);
    expect(state.lumensPerSecond).toBe(0);
    expect(state.upgrades).toEqual({});
    expect(state.victoryReached).toBe(false);
    expect(state.sunPurchased).toBe(false);
  });

  it('is mutable', () => {
    state.lumens = 100;
    state.totalLumens = 200;
    state.clickPower = 5;
    expect(state.lumens).toBe(100);
    expect(state.totalLumens).toBe(200);
    expect(state.clickPower).toBe(5);
  });
});

describe('VICTORY_LUMENS', () => {
  it('equals 1 trillion', () => {
    expect(VICTORY_LUMENS).toBe(1000000000000);
  });
});

describe('game mode', () => {
  afterEach(() => {
    setGameMode(null);
    setGameStarted(false);
  });

  it('starts as null', () => {
    setGameMode(null);
    // gameMode is a let export, so we test via getSaveKey behavior
    expect(getSaveKey()).toBe('lights-on-save');
  });

  it('setGameMode changes the mode', () => {
    setGameMode('off');
    expect(getSaveKey()).toBe('lights-off-save');
    setGameMode('on');
    expect(getSaveKey()).toBe('lights-on-save');
  });
});

describe('getSaveKey', () => {
  afterEach(() => {
    setGameMode(null);
  });

  it('returns lights-on-save for ON mode', () => {
    setGameMode('on');
    expect(getSaveKey()).toBe('lights-on-save');
  });

  it('returns lights-off-save for OFF mode', () => {
    setGameMode('off');
    expect(getSaveKey()).toBe('lights-off-save');
  });

  it('defaults to lights-on-save for null mode', () => {
    setGameMode(null);
    expect(getSaveKey()).toBe('lights-on-save');
  });
});

describe('getUpgradeCount', () => {
  beforeEach(() => {
    state.upgrades = {};
  });

  it('returns 0 for unpurchased upgrades', () => {
    expect(getUpgradeCount('spark')).toBe(0);
    expect(getUpgradeCount('nonexistent')).toBe(0);
  });

  it('returns the count for purchased upgrades', () => {
    state.upgrades = { spark: 5, candle: 3 };
    expect(getUpgradeCount('spark')).toBe(5);
    expect(getUpgradeCount('candle')).toBe(3);
  });
});

describe('shared flags', () => {
  it('has correct initial values', () => {
    expect(shared.sunCinematicActive).toBe(false);
    expect(shared.sunCinematicProgress).toBe(0);
    expect(shared.mouseX).toBe(0);
    expect(shared.mouseY).toBe(0);
    expect(shared.adminMode).toBe(false);
    expect(shared.pendingReward).toBe(false);
  });

  it('is mutable', () => {
    shared.adminMode = true;
    expect(shared.adminMode).toBe(true);
    shared.adminMode = false;
  });
});

describe('prestige system', () => {
  afterEach(() => {
    setPrestigeLevel(0);
    setPrestigeMultiplier(1);
    localStorage.clear();
  });

  it('saves and loads prestige data', () => {
    setPrestigeLevel(3);
    savePrestige();

    // Reset in-memory values
    setPrestigeLevel(0);
    setPrestigeMultiplier(1);

    loadPrestige();
    expect(prestigeLevel).toBe(3);
    expect(prestigeMultiplier).toBe(2.5); // 1 + 3 * 0.5
  });

  it('handles missing prestige data gracefully', () => {
    localStorage.clear();
    loadPrestige();
    // Should not throw, values stay at defaults
    expect(prestigeLevel).toBe(0);
    expect(prestigeMultiplier).toBe(1);
  });

  it('calculates multiplier as 1 + level * 0.5', () => {
    setPrestigeLevel(0);
    setPrestigeMultiplier(1);
    localStorage.setItem(PRESTIGE_SAVE_KEY, JSON.stringify({ level: 5 }));
    loadPrestige();
    expect(prestigeMultiplier).toBe(3.5); // 1 + 5 * 0.5
  });
});
