// === Victory — Switch, cinematic, victory screen, prestige, restart ===
'use strict';

import { state, shared, gameMode, prestigeLevel, setPrestigeLevel, setPrestigeMultiplier, savePrestige, getSaveKey } from './state.js';
import { _st, _raf, easeOutCubic } from './utils.js';
import { switchContainer, lightSwitch, switchLever, victoryScreen, prestigeInfo, gameArea, restartBtn, prestigeBtn, resetBtn } from './dom.js';
import { canvas } from './canvas.js';
import { resetHalos } from './effects/halos.js';
import { resetBursts } from './effects/bursts.js';
import { resetPrismRays } from './effects/prism.js';
import { resetLightningBolts } from './effects/lightning.js';
import { resetStars } from './effects/stars.js';
import { resetConstellations } from './effects/constellations.js';
import { resetBigBang } from './effects/bigbang.js';
import { resetBlackHole } from './effects/blackhole.js';
import { save } from './save.js';

export function showSwitch() {
  switchContainer.classList.remove('hidden');
  if (gameMode === 'off') {
    switchLever.classList.add('on');
  }
}

function triggerVictory() {
  state.victoryReached = true;
  var nextMult = 1 + (prestigeLevel + 1) * 0.5;
  prestigeInfo.textContent = 'Cross over. x' + nextMult.toFixed(1) + ' power awaits.';
  victoryScreen.classList.remove('hidden');
  save();
}

export function playSunCinematic() {
  shared.sunCinematicActive = true;
  shared.sunCinematicProgress = 0;

  // Clear existing effects
  resetHalos();
  resetBursts();
  resetPrismRays();
  resetLightningBolts();
  resetStars();
  resetConstellations();
  resetBigBang();
  resetBlackHole();

  // Create cinematic canvas
  const cinCanvas = document.createElement('canvas');
  cinCanvas.id = 'sun-cinematic';
  cinCanvas.width = window.innerWidth;
  cinCanvas.height = window.innerHeight;
  cinCanvas.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;z-index:45;pointer-events:none;';
  gameArea.appendChild(cinCanvas);
  const cinCtx = cinCanvas.getContext('2d');

  const centerX = cinCanvas.width / 2;
  const centerY = cinCanvas.height * 0.35;
  const maxRadius = Math.max(cinCanvas.width, cinCanvas.height) * 1.5;

  const isOff = gameMode === 'off';
  function cinRgba(r, g, b, a) {
    if (isOff) return 'rgba(' + (255 - r) + ', ' + (255 - g) + ', ' + (255 - b) + ', ' + a + ')';
    return 'rgba(' + r + ', ' + g + ', ' + b + ', ' + a + ')';
  }
  const fillEnd = isOff ? '#000' : '#fff';

  function animateCinematic() {
    shared.sunCinematicProgress += 0.003;

    cinCtx.clearRect(0, 0, cinCanvas.width, cinCanvas.height);

    if (shared.sunCinematicProgress < 1.0) {
      // Phase 1: Growing core
      if (shared.sunCinematicProgress < 0.5) {
        const phase1 = shared.sunCinematicProgress / 0.5;
        const sunRadius = easeOutCubic(phase1) * 60;
        const glowRadius = easeOutCubic(phase1) * 200;
        const alpha = easeOutCubic(phase1);

        const outerGlow = cinCtx.createRadialGradient(centerX, centerY, 0, centerX, centerY, glowRadius);
        outerGlow.addColorStop(0, cinRgba(255, 240, 200, alpha * 0.4));
        outerGlow.addColorStop(0.3, cinRgba(255, 220, 150, alpha * 0.2));
        outerGlow.addColorStop(1, cinRgba(255, 200, 100, 0));
        cinCtx.beginPath();
        cinCtx.arc(centerX, centerY, glowRadius, 0, Math.PI * 2);
        cinCtx.fillStyle = outerGlow;
        cinCtx.fill();

        const coreGlow = cinCtx.createRadialGradient(centerX, centerY, 0, centerX, centerY, sunRadius);
        coreGlow.addColorStop(0, cinRgba(255, 255, 255, alpha));
        coreGlow.addColorStop(0.6, cinRgba(255, 250, 230, alpha * 0.8));
        coreGlow.addColorStop(1, cinRgba(255, 240, 200, 0));
        cinCtx.beginPath();
        cinCtx.arc(centerX, centerY, sunRadius, 0, Math.PI * 2);
        cinCtx.fillStyle = coreGlow;
        cinCtx.fill();
      }

      // Phase 2: Rays burst
      if (shared.sunCinematicProgress >= 0.25 && shared.sunCinematicProgress < 0.75) {
        const phase2 = (shared.sunCinematicProgress - 0.25) / 0.5;
        const rayCount = 12;
        const rayLength = easeOutCubic(phase2) * maxRadius * 0.6;
        const rayAlpha = Math.min(phase2 * 2, 1) * (1 - Math.max(0, (phase2 - 0.7) / 0.3));

        for (let i = 0; i < rayCount; i++) {
          const angle = (i / rayCount) * Math.PI * 2 + shared.sunCinematicProgress * 0.5;
          const endX = centerX + Math.cos(angle) * rayLength;
          const endY = centerY + Math.sin(angle) * rayLength;

          const rayGrad = cinCtx.createLinearGradient(centerX, centerY, endX, endY);
          rayGrad.addColorStop(0, cinRgba(255, 255, 240, rayAlpha * 0.8));
          rayGrad.addColorStop(1, cinRgba(255, 255, 240, 0));

          cinCtx.beginPath();
          cinCtx.moveTo(centerX, centerY);
          cinCtx.lineTo(endX, endY);
          cinCtx.strokeStyle = rayGrad;
          cinCtx.lineWidth = 3 + phase2 * 8;
          cinCtx.stroke();
        }

        const sunR = 60 + phase2 * 30;
        const coreGlow = cinCtx.createRadialGradient(centerX, centerY, 0, centerX, centerY, sunR);
        coreGlow.addColorStop(0, cinRgba(255, 255, 255, 1));
        coreGlow.addColorStop(0.5, cinRgba(255, 250, 230, 0.9));
        coreGlow.addColorStop(1, cinRgba(255, 240, 200, 0));
        cinCtx.beginPath();
        cinCtx.arc(centerX, centerY, sunR, 0, Math.PI * 2);
        cinCtx.fillStyle = coreGlow;
        cinCtx.fill();
      }

      // Phase 3: Flood fills the screen
      if (shared.sunCinematicProgress >= 0.55) {
        const phase3 = (shared.sunCinematicProgress - 0.55) / 0.45;
        const floodRadius = easeOutCubic(phase3) * maxRadius;
        const floodAlpha = easeOutCubic(phase3);

        const flood = cinCtx.createRadialGradient(centerX, centerY, 0, centerX, centerY, floodRadius);
        flood.addColorStop(0, cinRgba(255, 255, 255, floodAlpha));
        flood.addColorStop(0.6, cinRgba(255, 255, 255, floodAlpha * 0.8));
        flood.addColorStop(1, cinRgba(255, 255, 255, floodAlpha * 0.3));
        cinCtx.beginPath();
        cinCtx.arc(centerX, centerY, floodRadius, 0, Math.PI * 2);
        cinCtx.fillStyle = flood;
        cinCtx.fill();
      }

      _raf(animateCinematic);
    } else {
      // Cinematic done — fill then show victory
      cinCtx.fillStyle = fillEnd;
      cinCtx.fillRect(0, 0, cinCanvas.width, cinCanvas.height);

      _st(function () {
        cinCanvas.remove();
        shared.sunCinematicActive = false;
        triggerVictory();
      }, 800);
    }
  }

  _raf(animateCinematic);
}

export function setupVictoryListeners() {
  lightSwitch.addEventListener('click', function (e) {
    e.stopPropagation();
    if (!state.sunPurchased || shared.sunCinematicActive) return;

    if (gameMode === 'off') {
      switchLever.classList.remove('on');
    } else {
      switchLever.classList.add('on');
    }

    _st(function () {
      switchContainer.classList.add('hidden');
      playSunCinematic();
    }, 600);
  });

  restartBtn.addEventListener('click', function (e) {
    e.stopPropagation();
    localStorage.removeItem(getSaveKey());
    localStorage.removeItem('light-game-mode');
    window.location.reload();
  });

  prestigeBtn.addEventListener('click', function (e) {
    e.stopPropagation();
    const newLevel = prestigeLevel + 1;
    setPrestigeLevel(newLevel);
    setPrestigeMultiplier(1 + newLevel * 0.5);
    savePrestige();
    localStorage.removeItem(getSaveKey());
    var newMode = gameMode === 'on' ? 'off' : 'on';
    localStorage.setItem('light-game-mode', newMode);
    window.location.reload();
  });

  let resetConfirmTimer = null;
  resetBtn.addEventListener('click', function (e) {
    e.stopPropagation();
    if (resetBtn.classList.contains('confirming')) {
      clearTimeout(resetConfirmTimer);
      resetBtn.classList.remove('confirming');
      resetBtn.textContent = 'Reset';
      localStorage.removeItem(getSaveKey());
      localStorage.removeItem('light-game-mode');
      window.location.reload();
    } else {
      resetBtn.classList.add('confirming');
      resetBtn.textContent = 'Sure?';
      resetConfirmTimer = _st(function () {
        resetBtn.classList.remove('confirming');
        resetBtn.textContent = 'Reset';
      }, 3000);
    }
  });
}
