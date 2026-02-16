// === Bursts — Light burst collectible orbs (Firefly/Comet upgrades) ===
'use strict';

import { state, gameMode, getUpgradeCount } from '../state.js';
import { rgba, _now } from '../utils.js';
import { canvas, ctx } from '../canvas.js';
import { halos } from './halos.js';

export const lightBursts = [];
let nextBurstTime = _now() + 8000 + Math.random() * 12000;

function spawnLightBurst() {
  const margin = 60;
  const x = margin + Math.random() * (canvas.width - margin * 2);
  const y = margin + Math.random() * (canvas.height - margin * 2);
  const cometCount = getUpgradeCount('comet');
  const bonusPercent = 0.03 + cometCount * 0.005;
  const baseBonus = Math.max(10, Math.floor(state.totalLumens * bonusPercent));
  const bonus = baseBonus + Math.floor(Math.random() * baseBonus);

  const angle = Math.random() * Math.PI * 2;
  const speed = 0.08 + Math.random() * 0.12;

  lightBursts.push({
    x, y,
    radius: 20,
    bonus: bonus,
    life: 1.0,
    decay: 0.002,
    pulse: 0,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    wanderAngle: angle,
    wanderSpeed: speed,
    flickerPhase: Math.random() * Math.PI * 2,
    restTimer: 0,
    twinkleTimer: 120 + Math.floor(Math.random() * 300),
    twinkleActive: 0,
    twinkleDuration: 0,
  });
}

export function checkBurstSpawn() {
  if (state.victoryReached || state.sunPurchased) return;
  const fireflyCount = getUpgradeCount('firefly');
  const cometCount = getUpgradeCount('comet');
  if (fireflyCount === 0 && cometCount === 0) return;
  const maxBursts = 3 + Math.floor(cometCount / 2);
  const baseInterval = Math.max(5000, 10000 - cometCount * 250);
  const randomExtra = Math.max(3000, 15000 - cometCount * 500);
  if (_now() >= nextBurstTime && lightBursts.length < maxBursts) {
    spawnLightBurst();
    nextBurstTime = _now() + baseInterval + Math.random() * randomExtra;
  }
}

export function updateLightBursts() {
  const margin = 30;
  for (let i = lightBursts.length - 1; i >= 0; i--) {
    const b = lightBursts[i];
    b.life -= b.decay;
    b.pulse += 0.05;
    if (b.life <= 0) {
      lightBursts[i] = lightBursts[lightBursts.length - 1];
      lightBursts.pop();
      continue;
    }

    if (b.restTimer > 0) {
      b.restTimer -= 1;
      b.vx *= 0.92;
      b.vy *= 0.92;
    } else {
      if (Math.random() < 0.003) {
        b.restTimer = 30 + Math.random() * 60;
      }
      b.wanderAngle += (Math.random() - 0.5) * 0.1;
      if (Math.random() < 0.005) {
        b.wanderAngle += (Math.random() - 0.5) * 0.8;
      }
      const targetVx = Math.cos(b.wanderAngle) * b.wanderSpeed;
      const targetVy = Math.sin(b.wanderAngle) * b.wanderSpeed;
      b.vx += (targetVx - b.vx) * 0.08;
      b.vy += (targetVy - b.vy) * 0.08;
    }

    b.x += b.vx;
    b.y += b.vy;

    if (b.x < margin) { b.wanderAngle = 0; b.x = margin; }
    if (b.x > canvas.width - margin) { b.wanderAngle = Math.PI; b.x = canvas.width - margin; }
    if (b.y < margin) { b.wanderAngle = Math.PI / 2; b.y = margin; }
    if (b.y > canvas.height - margin) { b.wanderAngle = -Math.PI / 2; b.y = canvas.height - margin; }

    if (b.twinkleActive > 0) {
      b.twinkleActive--;
    } else {
      b.twinkleTimer--;
      if (b.twinkleTimer <= 0) {
        const dur = 10 + Math.floor(Math.random() * 10);
        b.twinkleActive = dur;
        b.twinkleDuration = dur;
        b.twinkleTimer = 120 + Math.floor(Math.random() * 300);
      }
    }
  }
}

export function drawLightBursts() {
  for (const b of lightBursts) {
    const lifeFade = Math.min(b.life * 2, 1);
    const twinkleT = b.twinkleDuration > 0 ? b.twinkleActive / b.twinkleDuration : 0;
    const twinkleIntensity = b.twinkleActive > 0 ? Math.sin(twinkleT * Math.PI) : 0;
    const flickerBase = Math.sin(b.pulse * 0.8 + b.flickerPhase);
    const flicker = 0.25 + 0.1 * flickerBase;
    const alpha = lifeFade * Math.min(flicker + twinkleIntensity * 0.75, 1.0);
    const pulseScale = 1 + 0.05 * Math.sin(b.pulse);
    const twinkleScale = 1 + twinkleIntensity * 0.4;
    const r = b.radius * pulseScale * twinkleScale;

    if (gameMode === 'off') {
      const gradient = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, r * 3);
      gradient.addColorStop(0, 'rgba(0, 0, 0, ' + (alpha * 0.5) + ')');
      gradient.addColorStop(0.3, 'rgba(20, 0, 35, ' + (alpha * 0.25) + ')');
      gradient.addColorStop(0.6, 'rgba(40, 0, 50, ' + (alpha * 0.08) + ')');
      gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.beginPath();
      ctx.arc(b.x, b.y, r * 3, 0, Math.PI * 2);
      ctx.fillStyle = gradient;
      ctx.fill();

      const core = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, r * 0.8);
      core.addColorStop(0, 'rgba(0, 0, 0, ' + (alpha * 0.85) + ')');
      core.addColorStop(0.6, 'rgba(15, 0, 25, ' + (alpha * 0.5) + ')');
      core.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.beginPath();
      ctx.arc(b.x, b.y, r * 0.8, 0, Math.PI * 2);
      ctx.fillStyle = core;
      ctx.fill();

      if (twinkleIntensity > 0.1) {
        const flashR = r * 1.5 * twinkleIntensity;
        const flash = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, flashR);
        flash.addColorStop(0, 'rgba(60, 0, 80, ' + (twinkleIntensity * alpha * 0.6) + ')');
        flash.addColorStop(1, 'rgba(30, 0, 50, 0)');
        ctx.beginPath();
        ctx.arc(b.x, b.y, flashR, 0, Math.PI * 2);
        ctx.fillStyle = flash;
        ctx.fill();
      }
    } else {
      const gradient = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, r * 2.5);
      gradient.addColorStop(0, rgba(255, 255, 220, alpha * 0.4));
      gradient.addColorStop(0.4, rgba(255, 255, 220, alpha * 0.12));
      gradient.addColorStop(1, rgba(255, 255, 220, 0));
      ctx.beginPath();
      ctx.arc(b.x, b.y, r * 2.5, 0, Math.PI * 2);
      ctx.fillStyle = gradient;
      ctx.fill();

      const core = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, r * 0.7);
      core.addColorStop(0, rgba(255, 255, 240, alpha * 0.9));
      core.addColorStop(1, rgba(255, 255, 240, alpha * 0.15));
      ctx.beginPath();
      ctx.arc(b.x, b.y, r * 0.7, 0, Math.PI * 2);
      ctx.fillStyle = core;
      ctx.fill();
    }
  }
}

export function clickLightBurst(x, y, checkMilestones, updateUI) {
  for (let i = lightBursts.length - 1; i >= 0; i--) {
    const b = lightBursts[i];
    const dx = x - b.x;
    const dy = y - b.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist <= b.radius * 3) {
      state.lumens += b.bonus;
      state.totalLumens += b.bonus;

      const explosionScale = Math.min(b.bonus / 100, 5) + 1;
      const explosionIntensity = Math.min(0.6 + explosionScale * 0.15, 1.0);

      if (gameMode === 'off') {
        halos.push({ type: 'void-implode', x: b.x, y: b.y, maxRadius: 80 * explosionScale, opacity: explosionIntensity * 0.8, life: 1.0, decay: 0.018, delay: 0 });
        halos.push({ type: 'void-stain', x: b.x, y: b.y, maxRadius: 50 * explosionScale, opacity: explosionIntensity * 0.4, life: 1.0, decay: 0.005, delay: 0 });
        const ringCount = Math.min(2 + Math.floor(explosionScale), 5);
        for (let r = 0; r < ringCount; r++) {
          halos.push({ type: 'void-ring', x: b.x, y: b.y, maxRadius: (70 + r * 40) * explosionScale, opacity: explosionIntensity * (0.6 - r * 0.1), life: 1.0, decay: 0.012 + r * 0.003, delay: r * 3 });
        }
      } else {
        halos.push({ type: 'glow', x: b.x, y: b.y, maxRadius: 60 * explosionScale, opacity: explosionIntensity, life: 1.0, decay: 0.015, delay: 0 });
        halos.push({ type: 'persist', x: b.x, y: b.y, maxRadius: 80 * explosionScale, opacity: explosionIntensity * 0.5, life: 1.0, decay: 0.006, delay: 0 });
        const ringCount = Math.min(2 + Math.floor(explosionScale), 6);
        for (let r = 0; r < ringCount; r++) {
          halos.push({ type: 'ring', x: b.x, y: b.y, maxRadius: (60 + r * 35) * explosionScale, opacity: explosionIntensity * (1 - r * 0.12), life: 1.0, decay: 0.01 + r * 0.003, delay: r * 4 });
        }
        const particleCount = Math.min(4 + Math.floor(explosionScale * 2), 14);
        for (let p = 0; p < particleCount; p++) {
          const angle = (p / particleCount) * Math.PI * 2 + Math.random() * 0.3;
          const pdist = 30 + Math.random() * 50 * explosionScale;
          halos.push({ type: 'glow', x: b.x + Math.cos(angle) * pdist, y: b.y + Math.sin(angle) * pdist, maxRadius: 15 + Math.random() * 20 * explosionScale, opacity: explosionIntensity * (0.4 + Math.random() * 0.3), life: 1.0, decay: 0.02 + Math.random() * 0.015, delay: 2 + Math.floor(Math.random() * 6) });
        }
      }

      lightBursts.splice(i, 1);
      checkMilestones();
      updateUI();
      return true;
    }
  }
  return false;
}

export function resetBursts() {
  lightBursts.length = 0;
}
