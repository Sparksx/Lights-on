// === Tests — utils.js ===
import { describe, it, expect, beforeEach } from 'vitest';

// We need to mock state.js before importing utils
// because utils.js imports gameMode from state.js
import * as state from '../../js/state.js';
import { formatNumber, unitName, easeOutCubic, rgb, rgba } from '../../js/utils.js';

describe('formatNumber', () => {
  it('formats numbers below 1000 as integers', () => {
    expect(formatNumber(0)).toBe('0');
    expect(formatNumber(1)).toBe('1');
    expect(formatNumber(999)).toBe('999');
    expect(formatNumber(42.7)).toBe('42');
  });

  it('formats thousands with K suffix', () => {
    expect(formatNumber(1000)).toBe('1.0K');
    expect(formatNumber(1500)).toBe('1.5K');
    expect(formatNumber(999999)).toBe('1000.0K');
  });

  it('formats millions with M suffix', () => {
    expect(formatNumber(1000000)).toBe('1.0M');
    expect(formatNumber(2500000)).toBe('2.5M');
  });

  it('formats billions with B suffix', () => {
    expect(formatNumber(1000000000)).toBe('1.0B');
    expect(formatNumber(7800000000)).toBe('7.8B');
  });

  it('formats trillions with T suffix', () => {
    expect(formatNumber(1000000000000)).toBe('1.0T');
    expect(formatNumber(1500000000000)).toBe('1.5T');
  });
});

describe('unitName', () => {
  it('returns "lm" in ON mode', () => {
    state.setGameMode('on');
    expect(unitName()).toBe('lm');
  });

  it('returns "ob" in OFF mode', () => {
    state.setGameMode('off');
    expect(unitName()).toBe('ob');
  });

  afterEach(() => {
    state.setGameMode(null);
  });
});

describe('rgb', () => {
  it('returns normal RGB in ON mode', () => {
    state.setGameMode('on');
    expect(rgb(255, 255, 255)).toBe('255, 255, 255');
    expect(rgb(0, 0, 0)).toBe('0, 0, 0');
    expect(rgb(128, 64, 32)).toBe('128, 64, 32');
  });

  it('returns inverted RGB in OFF mode', () => {
    state.setGameMode('off');
    expect(rgb(255, 255, 255)).toBe('0, 0, 0');
    expect(rgb(0, 0, 0)).toBe('255, 255, 255');
    expect(rgb(100, 150, 200)).toBe('155, 105, 55');
  });

  afterEach(() => {
    state.setGameMode(null);
  });
});

describe('rgba', () => {
  it('wraps rgb with alpha value', () => {
    state.setGameMode('on');
    expect(rgba(255, 255, 255, 0.5)).toBe('rgba(255, 255, 255, 0.5)');
    expect(rgba(0, 0, 0, 1)).toBe('rgba(0, 0, 0, 1)');
  });

  it('respects mode inversion', () => {
    state.setGameMode('off');
    expect(rgba(255, 255, 255, 0.8)).toBe('rgba(0, 0, 0, 0.8)');
  });

  afterEach(() => {
    state.setGameMode(null);
  });
});

describe('easeOutCubic', () => {
  it('returns 0 at t=0', () => {
    expect(easeOutCubic(0)).toBe(0);
  });

  it('returns 1 at t=1', () => {
    expect(easeOutCubic(1)).toBe(1);
  });

  it('returns intermediate values', () => {
    const mid = easeOutCubic(0.5);
    expect(mid).toBeGreaterThan(0.5);
    expect(mid).toBeLessThan(1);
    expect(mid).toBeCloseTo(0.875, 3);
  });
});
