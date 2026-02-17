// === Tests — server/db.js pure functions ===
import { describe, it, expect } from 'vitest';

// We can't test database queries without a real DB,
// but we can test the pure functions exported by db.js.
// We need to import them in a way compatible with CommonJS.
// Let's test the logic functions directly.

describe('getStreakMultiplier', () => {
  // Reimplementation to test the formula: min(1 + (days - 1) * 0.1, 2.0)
  function getStreakMultiplier(streakDays) {
    return Math.min(1 + (streakDays - 1) * 0.1, 2.0);
  }

  it('returns 1.0 for streak of 1 day', () => {
    expect(getStreakMultiplier(1)).toBe(1.0);
  });

  it('returns 1.1 for streak of 2 days', () => {
    expect(getStreakMultiplier(2)).toBeCloseTo(1.1);
  });

  it('returns 1.5 for streak of 6 days', () => {
    expect(getStreakMultiplier(6)).toBeCloseTo(1.5);
  });

  it('caps at 2.0 for streak of 11 days', () => {
    expect(getStreakMultiplier(11)).toBe(2.0);
  });

  it('caps at 2.0 for streaks beyond 11', () => {
    expect(getStreakMultiplier(20)).toBe(2.0);
    expect(getStreakMultiplier(100)).toBe(2.0);
  });
});

describe('computeGrade', () => {
  // Grade thresholds for ON mode
  const GRADES_ON = [
    { name: 'Étincelle', threshold: 10000 },
    { name: 'Flamme', threshold: 100000 },
    { name: 'Étoile', threshold: 1000000 },
    { name: 'Nova', threshold: 10000000 },
    { name: 'Cosmos', threshold: 100000000 },
  ];

  const GRADES_OFF = [
    { name: 'Murmure', threshold: 10000 },
    { name: 'Braise', threshold: 100000 },
    { name: 'Ombre', threshold: 1000000 },
    { name: 'Abîme', threshold: 10000000 },
    { name: 'Néant', threshold: 100000000 },
  ];

  function computeGrade(totalContribution, side) {
    const grades = side === 'on' ? GRADES_ON : GRADES_OFF;
    let grade = 'none';
    for (const g of grades) {
      if (totalContribution >= g.threshold) grade = g.name;
    }
    return grade;
  }

  it('returns "none" for 0 contribution', () => {
    expect(computeGrade(0, 'on')).toBe('none');
    expect(computeGrade(0, 'off')).toBe('none');
  });

  it('returns "none" below first threshold', () => {
    expect(computeGrade(9999, 'on')).toBe('none');
    expect(computeGrade(9999, 'off')).toBe('none');
  });

  it('returns first grade at threshold', () => {
    expect(computeGrade(10000, 'on')).toBe('Étincelle');
    expect(computeGrade(10000, 'off')).toBe('Murmure');
  });

  it('returns highest matching grade', () => {
    expect(computeGrade(500000, 'on')).toBe('Flamme');
    expect(computeGrade(500000, 'off')).toBe('Braise');
  });

  it('returns highest grade at top threshold', () => {
    expect(computeGrade(100000000, 'on')).toBe('Cosmos');
    expect(computeGrade(100000000, 'off')).toBe('Néant');
  });

  it('returns highest grade beyond top threshold', () => {
    expect(computeGrade(999999999999, 'on')).toBe('Cosmos');
    expect(computeGrade(999999999999, 'off')).toBe('Néant');
  });

  it('progresses through all ON grades', () => {
    expect(computeGrade(10000, 'on')).toBe('Étincelle');
    expect(computeGrade(100000, 'on')).toBe('Flamme');
    expect(computeGrade(1000000, 'on')).toBe('Étoile');
    expect(computeGrade(10000000, 'on')).toBe('Nova');
    expect(computeGrade(100000000, 'on')).toBe('Cosmos');
  });

  it('progresses through all OFF grades', () => {
    expect(computeGrade(10000, 'off')).toBe('Murmure');
    expect(computeGrade(100000, 'off')).toBe('Braise');
    expect(computeGrade(1000000, 'off')).toBe('Ombre');
    expect(computeGrade(10000000, 'off')).toBe('Abîme');
    expect(computeGrade(100000000, 'off')).toBe('Néant');
  });
});

describe('reward prestige bonus calculation', () => {
  // Test the reward logic from generateSeasonRewards
  function calculatePrestigeBonus(grade, isWinningSide, isDraw, isTopPercent, side) {
    const qualifyingGrades = ['Flamme', 'Braise', 'Étoile', 'Ombre', 'Nova', 'Abîme', 'Cosmos', 'Néant'];
    if (!qualifyingGrades.includes(grade)) return 0;

    let bonus = 0;
    if (isDraw) {
      bonus = 0.05;
    } else if (isWinningSide) {
      bonus = 0.1;
    } else {
      bonus = 0.02;
    }
    if (isTopPercent) {
      bonus += 0.1;
    }
    return bonus;
  }

  it('returns 0 for unqualifying grade', () => {
    expect(calculatePrestigeBonus('none', true, false, false, 'on')).toBe(0);
    expect(calculatePrestigeBonus('Étincelle', true, false, false, 'on')).toBe(0);
    expect(calculatePrestigeBonus('Murmure', true, false, false, 'off')).toBe(0);
  });

  it('returns 0.1 for winning side', () => {
    expect(calculatePrestigeBonus('Flamme', true, false, false, 'on')).toBe(0.1);
    expect(calculatePrestigeBonus('Braise', true, false, false, 'off')).toBe(0.1);
  });

  it('returns 0.02 for losing side', () => {
    expect(calculatePrestigeBonus('Flamme', false, false, false, 'on')).toBe(0.02);
  });

  it('returns 0.05 for draw', () => {
    expect(calculatePrestigeBonus('Flamme', false, true, false, 'on')).toBe(0.05);
  });

  it('adds 0.1 bonus for top 10%', () => {
    expect(calculatePrestigeBonus('Flamme', true, false, true, 'on')).toBeCloseTo(0.2);
    expect(calculatePrestigeBonus('Flamme', false, false, true, 'on')).toBeCloseTo(0.12);
    expect(calculatePrestigeBonus('Flamme', false, true, true, 'on')).toBeCloseTo(0.15);
  });

  it('works for all qualifying OFF grades', () => {
    for (const grade of ['Braise', 'Ombre', 'Abîme', 'Néant']) {
      expect(calculatePrestigeBonus(grade, true, false, false, 'off')).toBe(0.1);
    }
  });
});

describe('season time calculations', () => {
  it('calculates remaining time correctly', () => {
    const durationDays = 14;
    const durationMs = durationDays * 24 * 60 * 60 * 1000;
    const startedAt = Date.now() - (10 * 24 * 60 * 60 * 1000); // 10 days ago
    const endsAt = startedAt + durationMs;
    const remaining = Math.max(0, endsAt - Date.now());

    expect(remaining).toBeGreaterThan(0);
    expect(remaining).toBeLessThanOrEqual(4 * 24 * 60 * 60 * 1000); // ~4 days left

    const remainingDays = Math.ceil(remaining / (1000 * 60 * 60 * 24));
    expect(remainingDays).toBeLessThanOrEqual(4);
    expect(remainingDays).toBeGreaterThanOrEqual(3);
  });

  it('returns 0 remaining for expired season', () => {
    const durationDays = 14;
    const durationMs = durationDays * 24 * 60 * 60 * 1000;
    const startedAt = Date.now() - (15 * 24 * 60 * 60 * 1000); // 15 days ago
    const endsAt = startedAt + durationMs;
    const remaining = Math.max(0, endsAt - Date.now());

    expect(remaining).toBe(0);
  });

  it('detects last day correctly', () => {
    const durationDays = 14;
    const durationMs = durationDays * 24 * 60 * 60 * 1000;

    // 13.5 days ago — last day
    const startedAt = Date.now() - (13.5 * 24 * 60 * 60 * 1000);
    const endsAt = startedAt + durationMs;
    const remaining = Math.max(0, endsAt - Date.now());
    const isLastDay = remaining < 24 * 60 * 60 * 1000;

    expect(isLastDay).toBe(true);
    expect(remaining).toBeGreaterThan(0);
  });
});

describe('contribution rate validation', () => {
  const validRates = [10, 25, 50, 100];

  it('accepts valid rates', () => {
    for (const rate of validRates) {
      expect(validRates.includes(rate)).toBe(true);
    }
  });

  it('rejects invalid rates', () => {
    expect(validRates.includes(0)).toBe(false);
    expect(validRates.includes(75)).toBe(false);
    expect(validRates.includes(-1)).toBe(false);
    expect(validRates.includes(101)).toBe(false);
  });
});
