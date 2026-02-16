// === UI — HUD, progress bar, toggle notification ===
'use strict';

import { state, VICTORY_LUMENS, shared, getUpgradeCount, prestigeLevel, prestigeMultiplier } from './state.js';
import { formatNumber, unitName, rgba } from './utils.js';
import { progressFill, upgradeToggle } from './dom.js';
import { canvas, ctx } from './canvas.js';
import { UPGRADES, getUpgradeCost } from './upgrades-data.js';
import { getComboMultiplier } from './interaction.js';

export function updateToggleNotification() {
  var hasNew = false;
  for (var i = 0; i < UPGRADES.length; i++) {
    var up = UPGRADES[i];
    var count = getUpgradeCount(up.id);
    if (count >= up.maxCount) continue;
    if (state.totalLumens < up.unlockAt) continue;
    if (state.lumens >= getUpgradeCost(up)) { hasNew = true; break; }
  }
  if (hasNew) {
    upgradeToggle.classList.add('has-new');
  } else {
    upgradeToggle.classList.remove('has-new');
  }
}

export function updateUI() {
  const progress = Math.min(state.totalLumens / VICTORY_LUMENS, 1);
  progressFill.style.width = (progress * 100) + '%';
  updateToggleNotification();
}

export function drawHUD() {
  if (state.victoryReached || state.sunPurchased || shared.sunCinematicActive) return;
  ctx.save();
  var fontSize = Math.floor(Math.min(canvas.width * 0.025, 14));
  ctx.font = fontSize + 'px "Courier New", monospace';
  ctx.textAlign = 'left';
  var hudAlpha = 0.3;
  ctx.fillStyle = rgba(255, 255, 255, hudAlpha);
  var padding = 12;
  var y = padding + fontSize + (window.CSS && CSS.supports('top', 'env(safe-area-inset-top)') ? 44 : 0);
  ctx.fillText(formatNumber(Math.floor(state.lumens)) + ' ' + unitName(), padding, y);
  if (state.lumensPerSecond > 0) {
    var lps = state.lumensPerSecond * prestigeMultiplier;
    ctx.fillText('+' + formatNumber(Math.floor(lps)) + '/s', padding, y + fontSize + 4);
  }
  var mult = getComboMultiplier();
  if (mult > 1) {
    ctx.fillStyle = rgba(255, 255, 255, 0.5);
    ctx.fillText('x' + mult, padding, y + (fontSize + 4) * 2);
  }
  if (prestigeLevel > 0) {
    ctx.textAlign = 'right';
    ctx.fillStyle = rgba(255, 255, 255, 0.2);
    ctx.fillText('P' + prestigeLevel + ' x' + prestigeMultiplier.toFixed(1), canvas.width - padding, y);
  }
  ctx.restore();
}
