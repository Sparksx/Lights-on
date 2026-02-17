// === E2E Tests — Core game flow ===
import { test, expect } from '@playwright/test';

test.describe('Mode Selection', () => {
  test.beforeEach(async ({ page }) => {
    // Clear localStorage to ensure fresh state
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
  });

  test('displays mode selection screen on first visit', async ({ page }) => {
    const modeSelect = page.locator('#mode-select');
    await expect(modeSelect).toBeVisible();

    const modeOn = page.locator('#mode-on');
    const modeOff = page.locator('#mode-off');
    await expect(modeOn).toBeVisible();
    await expect(modeOff).toBeVisible();

    const title = page.locator('#mode-title');
    await expect(title).toHaveText('LIGHT');
  });

  test('selecting ON mode starts the game', async ({ page }) => {
    await page.locator('#mode-on').click();

    // Wait for mode selection to disappear and game area to appear
    await expect(page.locator('#game-area')).toBeVisible({ timeout: 3000 });

    // Canvas should be visible
    await expect(page.locator('#halo-canvas')).toBeVisible();
  });

  test('selecting OFF mode starts the game with inverted theme', async ({ page }) => {
    await page.locator('#mode-off').click();

    await expect(page.locator('#game-area')).toBeVisible({ timeout: 3000 });

    // Body should have mode-off class
    await expect(page.locator('body')).toHaveClass(/mode-off/);
  });
});

test.describe('Game Mechanics', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();

    // Start game in ON mode
    await page.locator('#mode-on').click();
    await expect(page.locator('#game-area')).toBeVisible({ timeout: 3000 });

    // Wait for intro to potentially show and dismiss it
    await page.waitForTimeout(500);
  });

  test('clicking the canvas generates lumens', async ({ page }) => {
    const canvas = page.locator('#halo-canvas');

    // Click the canvas multiple times
    for (let i = 0; i < 10; i++) {
      await canvas.click({ position: { x: 200, y: 300 } });
      await page.waitForTimeout(50);
    }

    // Check that lumens counter shows > 0
    const counter = page.locator('#lumen-counter');
    const text = await counter.textContent();
    // Counter should show some lumens (not "0 lm")
    expect(text).not.toBe('0 lm');
  });

  test('upgrade panel can be toggled', async ({ page }) => {
    const upgradeToggle = page.locator('#upgrade-toggle');

    // The toggle might be hidden initially for new games, wait for it
    // Click canvas first to gain some lumens
    const canvas = page.locator('#halo-canvas');
    for (let i = 0; i < 5; i++) {
      await canvas.click({ position: { x: 200, y: 300 } });
      await page.waitForTimeout(50);
    }

    // If toggle is visible, click it to open panel
    if (await upgradeToggle.isVisible()) {
      await upgradeToggle.click();
      const panel = page.locator('#upgrade-panel');
      await expect(panel).toHaveClass(/open/);

      // Close the panel
      const closeBtn = page.locator('#upgrade-close');
      await closeBtn.click();
    }
  });
});

test.describe('Persistence', () => {
  test('saves and restores game state', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();

    // Start ON mode
    await page.locator('#mode-on').click();
    await expect(page.locator('#game-area')).toBeVisible({ timeout: 3000 });
    await page.waitForTimeout(500);

    // Click to earn lumens
    const canvas = page.locator('#halo-canvas');
    for (let i = 0; i < 20; i++) {
      await canvas.click({ position: { x: 200, y: 300 } });
      await page.waitForTimeout(50);
    }

    // Wait for auto-save (5s interval, or we trigger a save)
    await page.waitForTimeout(5500);

    // Verify save exists in localStorage
    const saveExists = await page.evaluate(() => {
      return localStorage.getItem('lights-on-save') !== null;
    });
    expect(saveExists).toBe(true);

    // Reload page — should skip mode selection
    await page.reload();
    await expect(page.locator('#game-area')).toBeVisible({ timeout: 3000 });

    // Mode selection should NOT be visible (auto-loaded save)
    await expect(page.locator('#mode-select')).not.toBeVisible();
  });
});

test.describe('Responsive Design', () => {
  test('renders correctly on mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();

    const modeSelect = page.locator('#mode-select');
    await expect(modeSelect).toBeVisible();

    await page.locator('#mode-on').click();
    await expect(page.locator('#game-area')).toBeVisible({ timeout: 3000 });
    await expect(page.locator('#halo-canvas')).toBeVisible();
  });
});
