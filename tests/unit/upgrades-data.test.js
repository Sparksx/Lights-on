// === Tests — upgrades-data.js ===
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { state, setGameMode } from '../../js/state.js';
import { UPGRADES, SHADOW_THEME, getUpgradeName, getUpgradeDesc, getUpgradeCost } from '../../js/upgrades-data.js';

describe('UPGRADES array', () => {
  it('has 24 entries (23 upgrades + victory)', () => {
    expect(UPGRADES.length).toBe(24);
  });

  it('each upgrade has required fields', () => {
    for (const up of UPGRADES) {
      expect(up).toHaveProperty('id');
      expect(up).toHaveProperty('name');
      expect(up).toHaveProperty('desc');
      expect(up).toHaveProperty('baseCost');
      expect(up).toHaveProperty('costMultiplier');
      expect(up).toHaveProperty('type');
      expect(up).toHaveProperty('value');
      expect(up).toHaveProperty('maxCount');
      expect(up).toHaveProperty('unlockAt');
    }
  });

  it('has unique ids', () => {
    const ids = UPGRADES.map((u) => u.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('types are valid', () => {
    const validTypes = ['passive', 'click', 'burst', 'victory'];
    for (const up of UPGRADES) {
      expect(validTypes).toContain(up.type);
    }
  });

  it('first upgrade unlocks at 0', () => {
    expect(UPGRADES[0].unlockAt).toBe(0);
  });

  it('last upgrade is the victory upgrade (sun)', () => {
    const last = UPGRADES[UPGRADES.length - 1];
    expect(last.id).toBe('sun');
    expect(last.type).toBe('victory');
    expect(last.baseCost).toBe(1000000000000);
  });

  it('unlock thresholds are in ascending order', () => {
    for (let i = 1; i < UPGRADES.length; i++) {
      expect(UPGRADES[i].unlockAt).toBeGreaterThanOrEqual(UPGRADES[i - 1].unlockAt);
    }
  });

  it('all baseCosts are positive', () => {
    for (const up of UPGRADES) {
      expect(up.baseCost).toBeGreaterThan(0);
    }
  });

  it('all maxCounts are positive', () => {
    for (const up of UPGRADES) {
      expect(up.maxCount).toBeGreaterThan(0);
    }
  });
});

describe('SHADOW_THEME', () => {
  it('has a shadow entry for every upgrade', () => {
    for (const up of UPGRADES) {
      expect(SHADOW_THEME).toHaveProperty(up.id);
      expect(SHADOW_THEME[up.id]).toHaveProperty('name');
      expect(SHADOW_THEME[up.id]).toHaveProperty('desc');
    }
  });

  it('shadow names are different from regular names', () => {
    for (const up of UPGRADES) {
      expect(SHADOW_THEME[up.id].name).not.toBe(up.name);
    }
  });
});

describe('getUpgradeName', () => {
  afterEach(() => {
    setGameMode(null);
  });

  it('returns regular name in ON mode', () => {
    setGameMode('on');
    const spark = UPGRADES.find((u) => u.id === 'spark');
    expect(getUpgradeName(spark)).toBe('Spark');
  });

  it('returns shadow name in OFF mode', () => {
    setGameMode('off');
    const spark = UPGRADES.find((u) => u.id === 'spark');
    expect(getUpgradeName(spark)).toBe('Whisper');
  });

  it('returns shadow name for sun in OFF mode', () => {
    setGameMode('off');
    const sun = UPGRADES.find((u) => u.id === 'sun');
    expect(getUpgradeName(sun)).toBe('Eclipse');
  });
});

describe('getUpgradeDesc', () => {
  afterEach(() => {
    setGameMode(null);
  });

  it('returns regular desc in ON mode', () => {
    setGameMode('on');
    const spark = UPGRADES.find((u) => u.id === 'spark');
    expect(getUpgradeDesc(spark)).toBe('Rub, and the glow is born');
  });

  it('returns shadow desc in OFF mode', () => {
    setGameMode('off');
    const spark = UPGRADES.find((u) => u.id === 'spark');
    expect(getUpgradeDesc(spark)).toBe('The first sound fading out');
  });
});

describe('getUpgradeCost', () => {
  beforeEach(() => {
    state.upgrades = {};
  });

  it('returns baseCost when no upgrades purchased', () => {
    const spark = UPGRADES.find((u) => u.id === 'spark');
    expect(getUpgradeCost(spark)).toBe(50);
  });

  it('scales cost exponentially with purchases', () => {
    const spark = UPGRADES.find((u) => u.id === 'spark');

    state.upgrades = { spark: 1 };
    const cost1 = getUpgradeCost(spark);
    expect(cost1).toBe(Math.floor(50 * Math.pow(1.4, 1)));

    state.upgrades = { spark: 5 };
    const cost5 = getUpgradeCost(spark);
    expect(cost5).toBe(Math.floor(50 * Math.pow(1.4, 5)));

    expect(cost5).toBeGreaterThan(cost1);
  });

  it('uses correct multiplier per upgrade', () => {
    const lightning = UPGRADES.find((u) => u.id === 'lightning');
    state.upgrades = { lightning: 3 };
    const expected = Math.floor(8000 * Math.pow(2.0, 3));
    expect(getUpgradeCost(lightning)).toBe(expected);
  });
});
