// === Prism — Prism ray mechanic (Prism upgrade) ===
'use strict';

import { state, gameMode, getUpgradeCount } from '../state.js';
import { rgba, _now } from '../utils.js';
import { canvas, ctx } from '../canvas.js';
import { halos } from './halos.js';

export const prismRays = [];
let nextRayTime = _now() + 15000 + Math.random() * 20000;
let prismHolding = false;
let prismHoldX = 0;
let prismHoldY = 0;

const RAINBOW = [
  'rgba(255, 0, 0, ',
  'rgba(255, 127, 0, ',
  'rgba(255, 255, 0, ',
  'rgba(0, 255, 0, ',
  'rgba(0, 127, 255, ',
  'rgba(75, 0, 130, ',
  'rgba(148, 0, 211, ',
];

function spawnPrismRay() {
  const w = canvas.width;
  const h = canvas.height;
  const side = Math.floor(Math.random() * 4);
  let startX, startY, endX, endY;

  if (side === 0) { startX = -10; startY = h * 0.2 + Math.random() * h * 0.6; endX = w + 10; endY = h * 0.2 + Math.random() * h * 0.6; }
  else if (side === 1) { startX = w * 0.2 + Math.random() * w * 0.6; startY = -10; endX = w * 0.2 + Math.random() * w * 0.6; endY = h + 10; }
  else if (side === 2) { startX = w + 10; startY = h * 0.2 + Math.random() * h * 0.6; endX = -10; endY = h * 0.2 + Math.random() * h * 0.6; }
  else { startX = w * 0.2 + Math.random() * w * 0.6; startY = h + 10; endX = w * 0.2 + Math.random() * w * 0.6; endY = -10; }

  const prismCount = getUpgradeCount('prism');
  const baseDuration = 6;
  const bonusDuration = Math.min(prismCount * 0.5, 6);
  const totalDuration = baseDuration + bonusDuration;

  prismRays.push({
    startX, startY, endX, endY,
    life: 1.0, decay: 1 / (totalDuration * 60),
    active: false, holdTime: 0, dispersePhase: 0, lumensGenerated: 0,
    fadeOutSpeed: 0, colorAngles: null, lastHoldX: 0, lastHoldY: 0,
  });
}

export function checkRaySpawn() {
  if (state.victoryReached || state.sunPurchased) return;
  if (getUpgradeCount('prism') === 0) return;
  if (_now() >= nextRayTime && prismRays.length < 2) {
    spawnPrismRay();
    const prismCount = getUpgradeCount('prism');
    const interval = Math.max(8000, 20000 - prismCount * 800);
    nextRayTime = _now() + interval + Math.random() * interval * 0.5;
  }
}

function pointToRayDistance(px, py, ray) {
  const dx = ray.endX - ray.startX;
  const dy = ray.endY - ray.startY;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return { dist: Infinity, cx: ray.startX, cy: ray.startY, t: 0 };
  let t = ((px - ray.startX) * dx + (py - ray.startY) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  const closestX = ray.startX + t * dx;
  const closestY = ray.startY + t * dy;
  const distX = px - closestX;
  const distY = py - closestY;
  return { dist: Math.sqrt(distX * distX + distY * distY), cx: closestX, cy: closestY, t: t };
}

export function updatePrismRays(checkMilestones, updateUI) {
  for (let i = prismRays.length - 1; i >= 0; i--) {
    const ray = prismRays[i];
    ray.active = false;
    if (prismHolding && ray.life > 0.05) {
      const result = pointToRayDistance(prismHoldX, prismHoldY, ray);
      if (result.dist < 50) {
        ray.active = true;
        ray.holdTime++;
        ray.fadeOutSpeed = 0;

        if (!ray.colorAngles) {
          ray.colorAngles = [];
          for (let c = 0; c < 7; c++) { ray.colorAngles.push(Math.random() * Math.PI * 2); }
          ray.lastHoldX = prismHoldX;
          ray.lastHoldY = prismHoldY;
        }

        const moveDx = prismHoldX - ray.lastHoldX;
        const moveDy = prismHoldY - ray.lastHoldY;
        const moveDist = Math.sqrt(moveDx * moveDx + moveDy * moveDy);
        if (moveDist > 1) {
          const shift = moveDist * 0.03;
          for (let c = 0; c < ray.colorAngles.length; c++) {
            ray.colorAngles[c] += shift * ((c % 2 === 0) ? 1 : -1) * (0.5 + c * 0.1);
          }
          ray.lastHoldX = prismHoldX;
          ray.lastHoldY = prismHoldY;
        }

        const prismCount = getUpgradeCount('prism');
        const baseLumens = 0.5 + prismCount * 0.3;
        const holdBonus = Math.min(ray.holdTime / 120, 2);
        const gain = baseLumens * (1 + holdBonus);
        state.lumens += gain;
        state.totalLumens += gain;
        ray.lumensGenerated += gain;
        ray.life -= ray.decay * 1.5;
        checkMilestones();
        updateUI();
      }
    }

    ray.life -= ray.decay;
    if (ray.life < 0.2) { ray.life -= ray.decay * 2; }
    if (ray.life <= 0) {
      prismRays[i] = prismRays[prismRays.length - 1];
      prismRays.pop();
    }
  }
}

export function drawPrismRays() {
  for (const ray of prismRays) {
    const alpha = Math.min(ray.life * 3, 1) * 0.8;
    if (alpha <= 0) continue;

    ctx.save();

    if (gameMode === 'off') {
      ctx.beginPath();
      ctx.moveTo(ray.startX, ray.startY);
      ctx.lineTo(ray.endX, ray.endY);
      const baseWidth = ray.active ? 4 : 2.5;
      const grad = ctx.createLinearGradient(ray.startX, ray.startY, ray.endX, ray.endY);
      grad.addColorStop(0, 'rgba(0, 0, 0, 0)');
      grad.addColorStop(0.15, 'rgba(0, 0, 0, ' + alpha + ')');
      grad.addColorStop(0.85, 'rgba(0, 0, 0, ' + alpha + ')');
      grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.strokeStyle = grad;
      ctx.lineWidth = baseWidth;
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(ray.startX, ray.startY);
      ctx.lineTo(ray.endX, ray.endY);
      ctx.strokeStyle = 'rgba(40, 0, 60, ' + (alpha * 0.2) + ')';
      ctx.lineWidth = baseWidth * 8;
      ctx.stroke();

      if (ray.active && prismHolding) {
        const result = pointToRayDistance(prismHoldX, prismHoldY, ray);
        const prismCount = getUpgradeCount('prism');
        const holdIntensity = Math.min(ray.holdTime / 60, 3);
        const prismIntensity = 1 + prismCount * 0.15;
        const totalIntensity = Math.min(holdIntensity * prismIntensity, 4);
        const vortexSize = 50 + totalIntensity * 40;
        const vortexGlow = ctx.createRadialGradient(result.cx, result.cy, 0, result.cx, result.cy, vortexSize);
        vortexGlow.addColorStop(0, 'rgba(0, 0, 0, ' + (alpha * Math.min(0.8 + totalIntensity * 0.1, 1.0)) + ')');
        vortexGlow.addColorStop(0.3, 'rgba(20, 0, 30, ' + (alpha * Math.min(0.4 + totalIntensity * 0.1, 0.7)) + ')');
        vortexGlow.addColorStop(0.7, 'rgba(40, 0, 60, ' + (alpha * 0.15) + ')');
        vortexGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.beginPath();
        ctx.arc(result.cx, result.cy, vortexSize, 0, Math.PI * 2);
        ctx.fillStyle = vortexGlow;
        ctx.fill();

        const armCount = 5;
        const spiralReach = 80 + totalIntensity * 50;
        const spiralPhase = ray.colorAngles ? ray.colorAngles[0] : 0;
        ctx.save();
        ctx.translate(result.cx, result.cy);
        for (let a = 0; a < armCount; a++) {
          const baseAngle = (a / armCount) * Math.PI * 2 + spiralPhase;
          ctx.beginPath();
          for (let t = 0; t < 1; t += 0.03) {
            const spiralR = vortexSize * 0.3 + t * (spiralReach - vortexSize * 0.3);
            const spiralA = baseAngle + t * Math.PI * 2;
            const sx = Math.cos(spiralA) * spiralR;
            const sy = Math.sin(spiralA) * spiralR;
            if (t === 0) ctx.moveTo(sx, sy); else ctx.lineTo(sx, sy);
          }
          const armAlpha = Math.min(ray.holdTime / 30, 1) * alpha;
          ctx.strokeStyle = 'rgba(0, 0, 0, ' + (armAlpha * 0.5) + ')';
          ctx.lineWidth = 1.5 + totalIntensity * 0.5;
          ctx.stroke();
        }
        ctx.restore();

        if (ray.holdTime % 20 === 0 && ray.holdTime > 0) {
          const lumensThisBurst = ray.lumensGenerated;
          if (lumensThisBurst > 0) {
            const burstIntensity = Math.min(lumensThisBurst / 50, 1.5) + 0.3;
            halos.push({ type: 'void-collapse', x: result.cx + (Math.random() - 0.5) * 20, y: result.cy + (Math.random() - 0.5) * 20, maxRadius: 40 * burstIntensity, opacity: 0.4 * burstIntensity, life: 1.0, decay: 0.03, delay: 0 });
            ray.lumensGenerated = 0;
          }
        }
      }

      if (ray.life < 0.5) {
        const fadeAlpha = ray.life / 0.5;
        ctx.beginPath();
        ctx.moveTo(ray.startX, ray.startY);
        ctx.lineTo(ray.endX, ray.endY);
        ctx.strokeStyle = 'rgba(0, 0, 0, ' + ((1 - fadeAlpha) * 0.2) + ')';
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 10]);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    } else {
      ctx.beginPath();
      ctx.moveTo(ray.startX, ray.startY);
      ctx.lineTo(ray.endX, ray.endY);
      const baseWidth = ray.active ? 3 : 2;
      const grad = ctx.createLinearGradient(ray.startX, ray.startY, ray.endX, ray.endY);
      grad.addColorStop(0, rgba(255, 255, 255, 0));
      grad.addColorStop(0.15, rgba(255, 255, 255, alpha));
      grad.addColorStop(0.85, rgba(255, 255, 255, alpha));
      grad.addColorStop(1, rgba(255, 255, 255, 0));
      ctx.strokeStyle = grad;
      ctx.lineWidth = baseWidth;
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(ray.startX, ray.startY);
      ctx.lineTo(ray.endX, ray.endY);
      ctx.strokeStyle = rgba(255, 255, 255, alpha * 0.15);
      ctx.lineWidth = baseWidth * 6;
      ctx.stroke();

      if (ray.active && prismHolding) {
        const result = pointToRayDistance(prismHoldX, prismHoldY, ray);
        const prismCount = getUpgradeCount('prism');
        const holdIntensity = Math.min(ray.holdTime / 60, 3);
        const prismIntensity = 1 + prismCount * 0.15;
        const totalIntensity = Math.min(holdIntensity * prismIntensity, 4);
        const glowSize = 60 + totalIntensity * 30;
        const prismGlow = ctx.createRadialGradient(result.cx, result.cy, 0, result.cx, result.cy, glowSize);
        prismGlow.addColorStop(0, rgba(255, 255, 255, alpha * Math.min(0.9 + totalIntensity * 0.1, 1.0)));
        prismGlow.addColorStop(0.3, rgba(255, 255, 255, alpha * Math.min(0.3 + totalIntensity * 0.15, 0.8)));
        prismGlow.addColorStop(1, rgba(255, 255, 255, 0));
        ctx.beginPath();
        ctx.arc(result.cx, result.cy, glowSize, 0, Math.PI * 2);
        ctx.fillStyle = prismGlow;
        ctx.fill();

        const rayLength = 100 + totalIntensity * 60;
        const rayWidth = 2.5 + totalIntensity * 1.5;
        for (let c = 0; c < RAINBOW.length; c++) {
          const angle = ray.colorAngles ? ray.colorAngles[c] : 0;
          const endRX = result.cx + Math.cos(angle) * rayLength;
          const endRY = result.cy + Math.sin(angle) * rayLength;
          const holdAlpha = Math.min(ray.holdTime / 30, 1) * alpha;
          const intensifiedAlpha = Math.min(holdAlpha * (1 + totalIntensity * 0.3), 1.0);
          ctx.beginPath();
          ctx.moveTo(result.cx, result.cy);
          ctx.lineTo(endRX, endRY);
          ctx.strokeStyle = RAINBOW[c] + (intensifiedAlpha * 0.7) + ')';
          ctx.lineWidth = rayWidth;
          ctx.stroke();
          const glowR = 10 + totalIntensity * 8;
          ctx.beginPath();
          ctx.arc(endRX, endRY, glowR, 0, Math.PI * 2);
          ctx.fillStyle = RAINBOW[c] + (intensifiedAlpha * 0.4) + ')';
          ctx.fill();
          if (totalIntensity > 1.5) {
            ctx.beginPath();
            ctx.moveTo(result.cx, result.cy);
            ctx.lineTo(endRX, endRY);
            ctx.strokeStyle = RAINBOW[c] + (intensifiedAlpha * 0.15) + ')';
            ctx.lineWidth = rayWidth * 4;
            ctx.stroke();
          }
        }

        if (ray.holdTime % 20 === 0 && ray.holdTime > 0) {
          const lumensThisBurst = ray.lumensGenerated;
          if (lumensThisBurst > 0) {
            const burstIntensity = Math.min(lumensThisBurst / 50, 1.5) + 0.3;
            halos.push({ type: 'glow', x: result.cx + (Math.random() - 0.5) * 20, y: result.cy + (Math.random() - 0.5) * 20, maxRadius: 30 * burstIntensity, opacity: 0.5 * burstIntensity, life: 1.0, decay: 0.03, delay: 0 });
            ray.lumensGenerated = 0;
          }
        }
      }

      if (ray.life < 0.5) {
        const fadeAlpha = ray.life / 0.5;
        ctx.beginPath();
        ctx.moveTo(ray.startX, ray.startY);
        ctx.lineTo(ray.endX, ray.endY);
        ctx.strokeStyle = rgba(255, 255, 255, (1 - fadeAlpha) * 0.3);
        ctx.lineWidth = baseWidth * 0.5;
        ctx.setLineDash([4, 8]);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }

    ctx.restore();
  }
}

export function startPrismHold(x, y, acIsPenaltyActive) {
  if (acIsPenaltyActive()) return;
  prismHolding = true;
  prismHoldX = x;
  prismHoldY = y;
}

export function movePrismHold(x, y) {
  if (!prismHolding) return;
  prismHoldX = x;
  prismHoldY = y;
}

export function endPrismHold() {
  prismHolding = false;
  for (const ray of prismRays) {
    ray.active = false;
    ray.holdTime = 0;
    ray.colorAngles = null;
  }
}

export function resetPrismRays() {
  prismRays.length = 0;
}
