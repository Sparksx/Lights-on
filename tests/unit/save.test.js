// === Tests — save.js ===
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { state, shared, setGameMode, getSaveKey } from '../../js/state.js';
import { save, load } from '../../js/save.js';

describe('save and load', () => {
  beforeEach(() => {
    setGameMode('on');
    // Reset state
    state.lumens = 0;
    state.totalLumens = 0;
    state.clickPower = 1;
    state.lumensPerSecond = 0;
    state.upgrades = {};
    state.victoryReached = false;
    state.sunPurchased = false;
    shared.acPenaltyCount = 0;
  });

  afterEach(() => {
    setGameMode(null);
    localStorage.clear();
  });

  it('save() writes to localStorage with correct key', () => {
    state.lumens = 500;
    save();
    const raw = localStorage.getItem('lights-on-save');
    expect(raw).not.toBeNull();
    const data = JSON.parse(raw);
    expect(data.lumens).toBe(500);
  });

  it('load() restores state from localStorage', () => {
    state.lumens = 12345;
    state.totalLumens = 54321;
    state.clickPower = 10;
    state.upgrades = { spark: 3, candle: 2 };
    state.victoryReached = false;
    state.sunPurchased = true;
    shared.acPenaltyCount = 2;
    save();

    // Reset state
    state.lumens = 0;
    state.totalLumens = 0;
    state.clickPower = 1;
    state.upgrades = {};
    state.sunPurchased = false;
    shared.acPenaltyCount = 0;

    const data = load();
    expect(data).not.toBeNull();
    expect(state.lumens).toBe(12345);
    expect(state.totalLumens).toBe(54321);
    expect(state.clickPower).toBe(10);
    expect(state.upgrades).toEqual({ spark: 3, candle: 2 });
    expect(state.sunPurchased).toBe(true);
    expect(shared.acPenaltyCount).toBe(2);
  });

  it('load() returns null when no save exists', () => {
    const data = load();
    expect(data).toBeNull();
  });

  it('save uses mode-dependent key', () => {
    setGameMode('on');
    state.lumens = 100;
    save();
    expect(localStorage.getItem('lights-on-save')).not.toBeNull();
    expect(localStorage.getItem('lights-off-save')).toBeNull();

    setGameMode('off');
    state.lumens = 200;
    save();
    expect(localStorage.getItem('lights-off-save')).not.toBeNull();
  });

  it('load uses mode-dependent key', () => {
    setGameMode('on');
    state.lumens = 111;
    save();

    setGameMode('off');
    state.lumens = 222;
    save();

    // Load ON save
    setGameMode('on');
    state.lumens = 0;
    load();
    expect(state.lumens).toBe(111);

    // Load OFF save
    setGameMode('off');
    state.lumens = 0;
    load();
    expect(state.lumens).toBe(222);
  });

  it('handles corrupted save data gracefully', () => {
    localStorage.setItem('lights-on-save', 'not valid json!!!');
    const data = load();
    expect(data).toBeNull();
  });

  it('save includes lastSaveTime', () => {
    save();
    const data = JSON.parse(localStorage.getItem('lights-on-save'));
    expect(data.lastSaveTime).toBeTypeOf('number');
    expect(data.lastSaveTime).toBeGreaterThan(0);
  });

  it('provides defaults for missing fields', () => {
    localStorage.setItem('lights-on-save', JSON.stringify({ lumens: 50 }));
    load();
    expect(state.lumens).toBe(50);
    expect(state.totalLumens).toBe(0); // fallback
    expect(state.clickPower).toBe(1); // fallback (0 || 1 = 1)
    expect(state.upgrades).toEqual({}); // fallback
    expect(state.victoryReached).toBe(false); // fallback
    expect(state.sunPurchased).toBe(false); // fallback
  });
});
