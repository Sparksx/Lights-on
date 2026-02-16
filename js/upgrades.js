// === Upgrades — Buy, render, milestones, panel ===
'use strict';

import { state, shared, getUpgradeCount, gameMode } from './state.js';
import { UPGRADES, getUpgradeName, getUpgradeDesc, getUpgradeCost } from './upgrades-data.js';
import { formatNumber, unitName, rgba } from './utils.js';
import { upgradeList, lumenCounter, upgradeToggle, upgradePanel, upgradeClose, adminCheckbox } from './dom.js';
import { canvas, ctx } from './canvas.js';
import { addEdgeGlow } from './effects/halos.js';
import { regenerateStars } from './effects/stars.js';
import { save } from './save.js';
import { showSwitch } from './victory.js';
import { updateUI, updateToggleNotification } from './ui.js';

// --- Milestones ---
let upgradeUnlocked = false;
const MILESTONE_THRESHOLDS = [
  100, 500, 1000, 5000, 10000, 50000, 100000, 500000, 1000000,
  5000000, 10000000, 50000000, 100000000, 500000000, 1000000000,
  10000000000, 100000000000, 500000000000, 1000000000000
];
let lastMilestoneIndex = -1;
let activeMilestone = null;

export function recalcPassive() {
  let lps = 0;
  for (const up of UPGRADES) {
    if (up.type === 'passive') {
      lps += up.value * getUpgradeCount(up.id);
    }
  }
  state.lumensPerSecond = lps;
}

export function buyUpgrade(upgrade) {
  const cost = getUpgradeCost(upgrade);
  const count = getUpgradeCount(upgrade.id);

  if (!shared.adminMode && state.lumens < cost) return;
  if (count >= upgrade.maxCount) return;

  if (!shared.adminMode) {
    state.lumens -= cost;
  }
  state.upgrades[upgrade.id] = count + 1;

  if (upgrade.type === 'click') {
    state.clickPower += upgrade.value;
  } else if (upgrade.type === 'victory') {
    state.sunPurchased = true;
    closeUpgradePanel();
    upgradeToggle.classList.add('hidden');
    showSwitch();
    save();
    return;
  }

  shared.pendingReward = true;
  recalcPassive();
  if (upgrade.id === 'star' || upgrade.id === 'constellation') {
    regenerateStars();
  }
  renderUpgrades();
  updateUI();
}

export function hasAffordableUpgrade() {
  for (const up of UPGRADES) {
    const count = getUpgradeCount(up.id);
    if (count >= up.maxCount) continue;
    if (state.totalLumens < up.unlockAt) continue;
    if (state.lumens >= getUpgradeCost(up)) return true;
  }
  return false;
}

export function renderUpgrades() {
  const unit = unitName();
  lumenCounter.textContent = formatNumber(Math.floor(state.lumens)) + ' ' + unit;
  upgradeList.innerHTML = '';

  let nextShownCount = 0;

  for (const up of UPGRADES) {
    const count = getUpgradeCount(up.id);
    const unlocked = state.totalLumens >= up.unlockAt;

    if (count === 0) {
      if (shared.adminMode) {
        // show all upgrades in admin mode
      } else if (!unlocked || nextShownCount >= 3) {
        continue;
      } else {
        nextShownCount++;
      }
    }

    const cost = getUpgradeCost(up);
    const canAfford = shared.adminMode || state.lumens >= cost;
    const isMaxed = count >= up.maxCount;

    const item = document.createElement('div');
    item.className = 'upgrade-item';
    if (isMaxed) {
      item.classList.add('maxed');
    } else if (!canAfford) {
      item.classList.add('locked');
    } else {
      item.classList.add('affordable');
    }

    const displayName = getUpgradeName(up);
    const displayDesc = getUpgradeDesc(up);
    const costLabel = isMaxed ? 'MAX' : (shared.adminMode ? 'FREE' : formatNumber(cost) + ' ' + unit);

    let effectLabel = '';
    if (up.type === 'passive') {
      effectLabel = '+' + formatNumber(up.value) + ' ' + unit + '/s';
    } else if (up.type === 'click') {
      effectLabel = '+' + formatNumber(up.value) + '/click';
    } else if (up.type === 'burst') {
      effectLabel = 'Spawns collectible orbs';
    } else if (up.type === 'victory') {
      effectLabel = 'Unlock the final switch';
    }

    item.innerHTML = `
      <div class="upgrade-name">${displayName}</div>
      <div class="upgrade-desc">${displayDesc}</div>
      <div class="upgrade-effect">${effectLabel}</div>
      <div class="upgrade-cost">${costLabel}</div>
      ${count > 0 ? `<div class="upgrade-count">x${count}</div>` : ''}
    `;

    if (!isMaxed && canAfford) {
      item.addEventListener('click', function (e) {
        e.stopPropagation();
        buyUpgrade(up);
      });
    }

    upgradeList.appendChild(item);
  }
}

export function checkMilestones() {
  if (!upgradeUnlocked && state.totalLumens >= 50) {
    upgradeUnlocked = true;
    upgradeToggle.classList.remove('hidden');
  }
  for (var i = MILESTONE_THRESHOLDS.length - 1; i >= 0; i--) {
    if (state.totalLumens >= MILESTONE_THRESHOLDS[i] && i > lastMilestoneIndex) {
      lastMilestoneIndex = i;
      activeMilestone = {
        text: formatNumber(MILESTONE_THRESHOLDS[i]) + ' ' + unitName() + '!',
        life: 1.0,
        y: canvas.height * 0.3,
      };
      break;
    }
  }
  updateToggleNotification();
}

export function updateMilestone() {
  if (!activeMilestone) return;
  activeMilestone.life -= 0.008;
  activeMilestone.y -= 0.3;
  if (activeMilestone.life <= 0) activeMilestone = null;
}

export function drawMilestone() {
  if (!activeMilestone) return;
  var m = activeMilestone;
  ctx.save();
  ctx.font = 'bold ' + Math.floor(Math.min(canvas.width * 0.04, 28)) + 'px "Courier New", monospace';
  ctx.textAlign = 'center';
  ctx.fillStyle = rgba(255, 255, 255, m.life * 0.8);
  ctx.fillText(m.text, canvas.width / 2, m.y);
  ctx.restore();
}

export function closeUpgradePanel() {
  upgradePanel.classList.remove('open');
  if (shared.pendingReward) {
    shared.pendingReward = false;
    addEdgeGlow();
  }
}

export function setupUpgradeListeners() {
  upgradeToggle.addEventListener('click', function (e) {
    e.stopPropagation();
    if (upgradePanel.classList.contains('open')) {
      closeUpgradePanel();
    } else {
      upgradePanel.classList.add('open');
      renderUpgrades();
    }
  });

  upgradeClose.addEventListener('click', function (e) {
    e.stopPropagation();
    closeUpgradePanel();
  });

  adminCheckbox.addEventListener('change', function (e) {
    e.stopPropagation();
    shared.adminMode = adminCheckbox.checked;
    renderUpgrades();
  });
}
