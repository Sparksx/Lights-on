// === Tests for multiplayer.js — pure logic functions ===

import { describe, it, expect, beforeEach } from 'vitest';
import { mp, reportLumens, getContributionAmount } from '../../js/multiplayer.js';

describe('reportLumens', () => {
  beforeEach(() => {
    mp.pendingLumens = 0;
  });

  it('should accumulate pending lumens', () => {
    reportLumens(100);
    expect(mp.pendingLumens).toBe(100);
    reportLumens(250);
    expect(mp.pendingLumens).toBe(350);
  });

  it('should handle zero amount', () => {
    reportLumens(0);
    expect(mp.pendingLumens).toBe(0);
  });

  it('should handle fractional amounts', () => {
    reportLumens(1.5);
    reportLumens(2.7);
    expect(mp.pendingLumens).toBeCloseTo(4.2);
  });
});

describe('getContributionAmount', () => {
  beforeEach(() => {
    mp.contributionRate = 25;
  });

  it('should apply default 25% rate', () => {
    expect(getContributionAmount(1000)).toBe(250);
  });

  it('should apply 10% rate', () => {
    mp.contributionRate = 10;
    expect(getContributionAmount(1000)).toBe(100);
  });

  it('should apply 50% rate', () => {
    mp.contributionRate = 50;
    expect(getContributionAmount(1000)).toBe(500);
  });

  it('should apply 100% rate', () => {
    mp.contributionRate = 100;
    expect(getContributionAmount(1000)).toBe(1000);
  });

  it('should floor the result', () => {
    mp.contributionRate = 10;
    expect(getContributionAmount(33)).toBe(3);
  });

  it('should return 0 for zero lumens', () => {
    expect(getContributionAmount(0)).toBe(0);
  });
});

describe('offline queue (localStorage)', () => {
  beforeEach(() => {
    mp.pendingLumens = 0;
    localStorage.clear();
  });

  it('should store pending lumens to localStorage key', () => {
    mp.pendingLumens = 500;
    localStorage.setItem('light-mp-offline-queue', String(mp.pendingLumens));
    expect(localStorage.getItem('light-mp-offline-queue')).toBe('500');
  });

  it('should restore from localStorage', () => {
    localStorage.setItem('light-mp-offline-queue', '1234');
    var val = Number(localStorage.getItem('light-mp-offline-queue'));
    mp.pendingLumens += val;
    expect(mp.pendingLumens).toBe(1234);
  });

  it('should handle missing queue gracefully', () => {
    var val = localStorage.getItem('light-mp-offline-queue');
    expect(val).toBeNull();
  });
});

describe('mp state initialization', () => {
  it('should have default values', () => {
    expect(mp.connected).toBe(false);
    expect(mp.contributionRate).toBe(25);
    expect(mp.cosmicWar.totalLight).toBe(0);
    expect(mp.cosmicWar.totalDark).toBe(0);
    expect(mp.online.total).toBe(0);
    expect(mp.pendingRewards).toEqual([]);
    expect(mp.seasonEndData).toBeNull();
  });

  it('should have season info defaults', () => {
    expect(mp.seasonInfo.season).toBe(0);
    expect(mp.seasonInfo.remainingDays).toBe(0);
    expect(mp.seasonInfo.isLastDay).toBe(false);
    expect(mp.seasonInfo.endsAt).toBeNull();
  });
});
