// === E2E Tests — Core game flow ===
import { test, expect } from '@playwright/test';

// Dismiss the intro overlay if visible (blocks canvas for 5s on new games)
async function dismissIntro(page) {
  const intro = page.locator('#intro-overlay:not(.hidden)');
  try {
    await intro.waitFor({ state: 'visible', timeout: 1000 });
    await intro.click();
    await intro.waitFor({ state: 'hidden', timeout: 2000 });
  } catch {
    // Intro not shown (existing save) — that's fine
  }
}

// Start a fresh game in the given mode
async function startFresh(page, mode = 'on') {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.locator(mode === 'on' ? '#mode-on' : '#mode-off').click();
  await expect(page.locator('#game-area')).toBeVisible({ timeout: 5000 });
  await dismissIntro(page);
}

test.describe('Mode Selection', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
  });

  test('displays mode selection screen on first visit', async ({ page }) => {
    await expect(page.locator('#mode-select')).toBeVisible();
    await expect(page.locator('#mode-on')).toBeVisible();
    await expect(page.locator('#mode-off')).toBeVisible();
    await expect(page.locator('#mode-title')).toHaveText('LIGHT');
  });

  test('selecting ON mode starts the game', async ({ page }) => {
    await page.locator('#mode-on').click();
    await expect(page.locator('#game-area')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('#halo-canvas')).toBeVisible();
  });

  test('selecting OFF mode starts the game with inverted theme', async ({ page }) => {
    await page.locator('#mode-off').click();
    await expect(page.locator('#game-area')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('body')).toHaveClass(/mode-off/);
  });
});

test.describe('Game Mechanics', () => {
  test.beforeEach(async ({ page }) => {
    await startFresh(page);
  });

  test('clicking the canvas generates lumens', async ({ page }) => {
    const canvas = page.locator('#halo-canvas');

    for (let i = 0; i < 10; i++) {
      await canvas.click({ position: { x: 200, y: 300 } });
      await page.waitForTimeout(80);
    }

    // Wait for UI to update
    await page.waitForTimeout(300);

    const text = await page.locator('#lumen-counter').textContent();
    expect(text).not.toBe('0 lm');
  });

  test('upgrade panel can be toggled', async ({ page }) => {
    const canvas = page.locator('#halo-canvas');
    for (let i = 0; i < 5; i++) {
      await canvas.click({ position: { x: 200, y: 300 } });
      await page.waitForTimeout(80);
    }

    const upgradeToggle = page.locator('#upgrade-toggle');
    if (await upgradeToggle.isVisible()) {
      await upgradeToggle.click();
      await expect(page.locator('#upgrade-panel')).toHaveClass(/open/);
      await page.locator('#upgrade-close').click();
    }
  });
});

test.describe('Persistence', () => {
  test('saves and restores game state', async ({ page }) => {
    await startFresh(page);

    const canvas = page.locator('#halo-canvas');
    for (let i = 0; i < 10; i++) {
      await canvas.click({ position: { x: 200, y: 300 } });
      await page.waitForTimeout(80);
    }

    // Wait for the auto-save (every 5s)
    await page.waitForTimeout(6000);

    const saveExists = await page.evaluate(() => localStorage.getItem('lights-on-save') !== null);
    expect(saveExists).toBe(true);

    // Reload — should skip mode selection
    await page.reload();
    await expect(page.locator('#game-area')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('#mode-select')).not.toBeVisible();
  });
});

test.describe('Responsive Design', () => {
  test('renders correctly on mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();

    await expect(page.locator('#mode-select')).toBeVisible();
    await page.locator('#mode-on').click();
    await expect(page.locator('#game-area')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('#halo-canvas')).toBeVisible();
  });
});
