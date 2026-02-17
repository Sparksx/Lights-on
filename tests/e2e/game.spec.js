// === E2E Tests — Core game flow ===
import { test, expect } from '@playwright/test';

// Start a fresh game — clears save, selects mode, waits for intro to clear
async function startFresh(page, mode = 'on') {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.locator(mode === 'on' ? '#mode-on' : '#mode-off').click();
  await expect(page.locator('#game-area')).toBeVisible({ timeout: 5000 });

  // New games show an intro overlay that blocks canvas clicks.
  // It auto-dismisses after 5s, or on click. Try clicking, then wait for fade-out.
  await page.waitForTimeout(500);
  await page
    .locator('#intro-overlay')
    .click({ timeout: 2000 })
    .catch(() => {});
  // Wait for fade-out animation (800ms) to complete
  await page.waitForTimeout(1200);
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
      await page.waitForTimeout(100);
    }

    // Poll until lumen counter updates (more reliable than a fixed wait)
    await expect(async () => {
      const text = await page.locator('#lumen-counter').textContent();
      expect(text).not.toBe('0 lm');
    }).toPass({ timeout: 5000 });
  });

  test('upgrade panel can be toggled', async ({ page }) => {
    const canvas = page.locator('#halo-canvas');
    for (let i = 0; i < 5; i++) {
      await canvas.click({ position: { x: 200, y: 300 } });
      await page.waitForTimeout(100);
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
      await page.waitForTimeout(100);
    }

    // Poll for auto-save instead of fixed timeout (save runs every 5s)
    await expect(async () => {
      const exists = await page.evaluate(() => localStorage.getItem('lights-on-save') !== null);
      expect(exists).toBe(true);
    }).toPass({ timeout: 10000 });

    // Reload — should skip mode selection and restore game
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
