// === Click — Click handler and input event listeners ===
'use strict';

import { state, shared, gameMode, getUpgradeCount, getTotalPrestigeMultiplier } from './state.js';
import { _st } from './utils.js';
import { gameArea } from './dom.js';
import { halos, addHalo } from './effects/halos.js';
import { spawnLightningBolt, spawnFissureCrack } from './effects/lightning.js';
import { clickLightBurst } from './effects/bursts.js';
import { startPrismHold, movePrismHold, endPrismHold } from './effects/prism.js';
import { startConstellationDrag, moveConstellationDrag, endConstellationDrag } from './effects/constellations.js';
import {
  startRub,
  moveRub,
  endRub,
  comboTimer,
  COMBO_DECAY,
  incrementCombo,
  resetCombo,
  setComboTimer,
  getComboMultiplier,
  showComboGlow,
  acRecordClick,
  acDetect,
  acTriggerPenalty,
  acIsPenaltyActive,
} from './interaction.js';
import { checkMilestones } from './upgrades.js';
import { updateUI } from './ui.js';
import { save } from './save.js';
import { reportLumens } from './multiplayer.js';

function handleClick(e) {
  if (state.victoryReached || state.sunPurchased || shared.sunCinematicActive) return;

  // Block synthetic/programmatic events (only allow real user input)
  if (!e.isTrusted && !e._trustedTouch) return;

  // Block all clicks during auto-clicker penalty
  if (acIsPenaltyActive()) return;

  // Don't count clicks on UI elements
  if (
    e.target.closest('#upgrade-panel') ||
    e.target.closest('#upgrade-toggle') ||
    e.target.closest('#switch-container')
  )
    return;

  const x = e.clientX || (e.touches && e.touches[0].clientX);
  const y = e.clientY || (e.touches && e.touches[0].clientY);

  if (x === undefined || y === undefined) return;

  // Record click for auto-clicker detection
  acRecordClick(x, y);
  if (acDetect()) {
    acTriggerPenalty(save);
    return;
  }

  // Check if clicking a light burst orb
  clickLightBurst(x, y, checkMilestones, updateUI);

  // Combo tracking
  incrementCombo();
  if (comboTimer) clearTimeout(comboTimer);
  setComboTimer(
    _st(function () {
      resetCombo();
    }, COMBO_DECAY),
  );

  const multiplier = getComboMultiplier();
  const gain = Math.floor(state.clickPower * multiplier * getTotalPrestigeMultiplier());

  state.lumens += gain;
  state.totalLumens += gain;
  reportLumens(gain);

  addHalo(x, y);
  if (multiplier > 1) {
    showComboGlow(x, y, multiplier);
    halos.push({
      type: 'combo-text',
      x: x + (Math.random() - 0.5) * 30,
      y: y - 20,
      maxRadius: 0,
      opacity: 0.9,
      life: 1.0,
      decay: 0.02,
      delay: 0,
      text: 'x' + multiplier,
    });
  }

  // Lightning/Fissure: bolt animation + flash/darken
  const lightningCount = getUpgradeCount('lightning');
  if (lightningCount > 0) {
    if (gameMode === 'off') {
      const hasFlash = halos.some(function (h) {
        return h.type === 'screen-darken' && h.life > 0.5;
      });
      if (!hasFlash) {
        const darkenIntensity = Math.min(0.06 + lightningCount * 0.01, 0.15);
        halos.push({
          type: 'screen-darken',
          x: 0,
          y: 0,
          maxRadius: 0,
          opacity: darkenIntensity,
          life: 1.0,
          decay: 0.03,
          delay: 0,
        });
        const crackCount = Math.min(1 + Math.floor(lightningCount / 3), 4);
        for (let c = 0; c < crackCount; c++) {
          spawnFissureCrack(x, y, lightningCount, c * 2);
        }
      }
    } else {
      const hasFlash = halos.some(function (h) {
        return h.type === 'screen-flash' && h.life > 0.5;
      });
      if (!hasFlash) {
        const flashIntensity = Math.min(0.04 + lightningCount * 0.008, 0.12);
        halos.push({
          type: 'screen-flash',
          x: 0,
          y: 0,
          maxRadius: 0,
          opacity: flashIntensity,
          life: 1.0,
          decay: 0.04,
          delay: 0,
        });
        const boltCount = Math.min(1 + Math.floor(lightningCount / 4), 3);
        for (let bolt = 0; bolt < boltCount; bolt++) {
          spawnLightningBolt(x, y, lightningCount, bolt * 3);
        }
      }
    }
  }
  checkMilestones();
  updateUI();
}

export function setupInputListeners() {
  gameArea.addEventListener('click', handleClick);

  gameArea.addEventListener(
    'touchstart',
    function (e) {
      if (
        e.target.closest('#upgrade-panel') ||
        e.target.closest('#upgrade-toggle') ||
        e.target.closest('#victory-screen') ||
        e.target.closest('#switch-container')
      )
        return;
      e.preventDefault();
      const touch = e.touches[0];
      shared.mouseX = touch.clientX;
      shared.mouseY = touch.clientY;
      startRub(touch.clientX, touch.clientY);
      startPrismHold(touch.clientX, touch.clientY, acIsPenaltyActive);
      startConstellationDrag(touch.clientX, touch.clientY, acIsPenaltyActive);
      handleClick({ clientX: touch.clientX, clientY: touch.clientY, target: e.target, _trustedTouch: e.isTrusted });
    },
    { passive: false },
  );

  gameArea.addEventListener('mousedown', function (e) {
    if (
      e.target.closest('#upgrade-panel') ||
      e.target.closest('#upgrade-toggle') ||
      e.target.closest('#switch-container')
    )
      return;
    startRub(e.clientX, e.clientY);
    startPrismHold(e.clientX, e.clientY, acIsPenaltyActive);
    startConstellationDrag(e.clientX, e.clientY, acIsPenaltyActive);
  });

  gameArea.addEventListener('mousemove', function (e) {
    shared.mouseX = e.clientX;
    shared.mouseY = e.clientY;
    if (e.target.closest('#upgrade-panel')) return;
    moveRub(e.clientX, e.clientY, checkMilestones, updateUI);
    movePrismHold(e.clientX, e.clientY);
    moveConstellationDrag(e.clientX, e.clientY, checkMilestones, updateUI);
  });

  gameArea.addEventListener('mouseup', function () {
    endRub();
    endPrismHold();
    endConstellationDrag();
  });
  gameArea.addEventListener('mouseleave', function () {
    endRub();
    endPrismHold();
    endConstellationDrag();
  });

  gameArea.addEventListener(
    'touchmove',
    function (e) {
      if (e.target.closest('#upgrade-panel')) return;
      e.preventDefault();
      const touch = e.touches[0];
      shared.mouseX = touch.clientX;
      shared.mouseY = touch.clientY;
      moveRub(touch.clientX, touch.clientY, checkMilestones, updateUI);
      movePrismHold(touch.clientX, touch.clientY);
      moveConstellationDrag(touch.clientX, touch.clientY, checkMilestones, updateUI);
    },
    { passive: false },
  );

  gameArea.addEventListener('touchend', function () {
    endRub();
    endPrismHold();
    endConstellationDrag();
  });
  gameArea.addEventListener('touchcancel', function () {
    endRub();
    endPrismHold();
    endConstellationDrag();
  });
}
