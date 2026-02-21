// === Game Loop — Main loop and passive income tick ===
'use strict';

import { state, shared, getTotalPrestigeMultiplier } from './state.js';
import { _raf } from './utils.js';
import { reportLumens } from './multiplayer.js';
import { canvas, ctx } from './canvas.js';

// Effects
import { updateStars, drawStars } from './effects/stars.js';
import { updateConstellations, checkConstellationSpawn, drawConstellations } from './effects/constellations.js';
import { updatePulsar, drawPulsar } from './effects/pulsar.js';
import { updateBigBang, checkBigBangSpawn, drawBigBang } from './effects/bigbang.js';
import { updateBlackHole, checkBlackHoleSpawn, drawBlackHole } from './effects/blackhole.js';
import { updateHalos, drawHalos } from './effects/halos.js';
import { updateLightBursts, checkBurstSpawn, drawLightBursts } from './effects/bursts.js';
import { updatePrismRays, checkRaySpawn, drawPrismRays } from './effects/prism.js';
import { updateLightningBolts, drawLightningBolts } from './effects/lightning.js';

// Game logic
import { updateAcExplosion, drawAcExplosion } from './interaction.js';
import { checkMilestones, updateMilestone, drawMilestone } from './upgrades.js';
import { updateUI, drawHUD } from './ui.js';

export function gameLoop() {
  // Update systems
  updateStars();
  updatePulsar();
  updateConstellations();
  checkConstellationSpawn();
  updateBigBang();
  checkBigBangSpawn();
  updateBlackHole();
  checkBlackHoleSpawn();
  updateHalos();
  updateLightBursts();
  updatePrismRays(checkMilestones, updateUI);
  updateLightningBolts();
  checkBurstSpawn();
  checkRaySpawn();
  updateAcExplosion();
  updateMilestone();

  // Clear canvas (transparent — background shows through)
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Draw (back to front)
  drawStars();
  drawConstellations();
  drawHalos();
  drawBigBang();
  drawBlackHole();
  drawLightningBolts();
  drawPrismRays();
  drawLightBursts();
  drawPulsar();
  drawMilestone();
  drawHUD();
  drawAcExplosion();
  _raf(gameLoop);
}

export function passiveTick() {
  if (state.victoryReached || state.sunPurchased || shared.seasonEndActive) return;
  if (state.lumensPerSecond > 0) {
    const gain = (state.lumensPerSecond * getTotalPrestigeMultiplier()) / 10; // called 10x per sec
    state.lumens += gain;
    state.totalLumens += gain;
    reportLumens(gain);
    checkMilestones();
    updateUI();
  }
}
