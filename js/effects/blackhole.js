// === Black Hole — Off mode replacement for Big Bang ===
'use strict';

import { state, gameMode, getUpgradeCount } from '../state.js';
import { rgba, _now, easeOutCubic } from '../utils.js';
import { canvas, ctx } from '../canvas.js';
import { halos } from './halos.js';
import { bgStars } from './stars.js';
import { lightBursts } from './bursts.js';

let blackHoleActive = false;
let blackHoleProgress = 0;
let blackHolePhase = 0;
let blackHoleParticles = [];
let blackHoleRadius = 0;
let blackHoleRotation = 0;
let nextBlackHoleTime = _now() + 30000 + Math.random() * 30000;

export function checkBlackHoleSpawn() {
  if (gameMode !== 'off') return;
  const bbCount = getUpgradeCount('bigbang');
  if (bbCount === 0) return;
  if (blackHoleActive) return;
  if (state.victoryReached || state.sunPurchased) return;
  if (_now() < nextBlackHoleTime) return;

  startBlackHole();
  const interval = Math.max(15000, 40000 - bbCount * 3000);
  nextBlackHoleTime = _now() + interval + Math.random() * interval * 0.5;
}

function startBlackHole() {
  blackHoleActive = true;
  blackHolePhase = 1;
  blackHoleProgress = 0;
  blackHoleParticles = [];
  blackHoleRadius = 0;

  const cx = canvas.width / 2;
  const cy = canvas.height / 2;

  let hasContent = false;

  for (const h of halos) {
    if ((h.type === 'glow' || h.type === 'persist') && h.life > 0.1) {
      hasContent = true;
      const dx = h.x - cx;
      const dy = h.y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const angle = Math.atan2(dy, dx);
      blackHoleParticles.push({
        x: h.x, y: h.y, originX: h.x, originY: h.y,
        angle: angle, dist: dist,
        size: 2 + Math.random() * 4, alpha: 0.6 + Math.random() * 0.4,
        spiralSpeed: 0.02 + Math.random() * 0.03, absorbed: false,
        stretch: 1, stretchAngle: angle,
      });
    }
  }

  for (const b of lightBursts) {
    hasContent = true;
    const dx = b.x - cx;
    const dy = b.y - cy;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const angle = Math.atan2(dy, dx);
    blackHoleParticles.push({
      x: b.x, y: b.y, originX: b.x, originY: b.y,
      angle: angle, dist: dist,
      size: 3 + Math.random() * 5, alpha: 0.7 + Math.random() * 0.3,
      spiralSpeed: 0.015 + Math.random() * 0.025, absorbed: false,
      stretch: 1, stretchAngle: angle,
    });
  }

  for (const s of bgStars) {
    const dx = s.x - cx;
    const dy = s.y - cy;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const angle = Math.atan2(dy, dx);
    blackHoleParticles.push({
      x: s.x, y: s.y, originX: s.x, originY: s.y,
      angle: angle, dist: dist,
      size: s.size + 0.5, alpha: 0.3 + Math.random() * 0.4,
      spiralSpeed: 0.01 + Math.random() * 0.02, absorbed: false,
      stretch: 1, stretchAngle: angle,
    });
  }

  if (!hasContent || blackHoleParticles.length < 30) {
    const count = 60;
    for (let i = 0; i < count; i++) {
      const px = Math.random() * canvas.width;
      const py = Math.random() * canvas.height;
      const dx = px - cx;
      const dy = py - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const angle = Math.atan2(dy, dx);
      blackHoleParticles.push({
        x: px, y: py, originX: px, originY: py,
        angle: angle, dist: dist,
        size: 1 + Math.random() * 3, alpha: 0.2 + Math.random() * 0.5,
        spiralSpeed: 0.01 + Math.random() * 0.03, absorbed: false,
        stretch: 1, stretchAngle: angle,
      });
    }
  }
}

export function updateBlackHole() {
  if (!blackHoleActive) return;

  blackHoleProgress += 0.006;
  blackHoleRotation += 0.08;
  const cx = canvas.width / 2;
  const cy = canvas.height / 2;
  const maxR = Math.min(canvas.width, canvas.height) * 0.08;

  if (blackHolePhase === 1) {
    blackHoleRadius = easeOutCubic(blackHoleProgress / 0.15) * maxR;
    if (blackHoleProgress >= 0.15) {
      blackHolePhase = 2;
    }
  } else if (blackHolePhase === 2) {
    blackHoleRadius = maxR;
    const absorbProgress = (blackHoleProgress - 0.15) / 0.6;
    let allAbsorbed = true;

    for (const p of blackHoleParticles) {
      if (p.absorbed) continue;
      p.angle += p.spiralSpeed * (1 + (1 - p.dist / (Math.max(canvas.width, canvas.height) * 0.8)) * 3);
      p.dist *= (0.985 - absorbProgress * 0.01);
      const proximityFactor = Math.max(0, 1 - p.dist / 200);
      p.stretch = 1 + proximityFactor * 4;
      p.stretchAngle = p.angle + Math.PI;
      p.x = cx + Math.cos(p.angle) * p.dist;
      p.y = cy + Math.sin(p.angle) * p.dist;

      if (p.dist < maxR * 0.5) {
        p.absorbed = true;
        p.alpha = 0;
      } else {
        p.alpha = Math.min(p.alpha, (p.dist / (maxR * 2)) * 0.8);
        allAbsorbed = false;
      }
    }

    if (allAbsorbed || blackHoleProgress >= 0.75) {
      blackHolePhase = 3;
    }
  } else if (blackHolePhase === 3) {
    const collapseProgress = Math.min((blackHoleProgress - 0.75) / 0.25, 1);
    blackHoleRadius = maxR * (1 - easeOutCubic(collapseProgress));

    for (const p of blackHoleParticles) {
      if (!p.absorbed) {
        p.dist *= 0.9;
        p.angle += p.spiralSpeed * 5;
        p.x = cx + Math.cos(p.angle) * p.dist;
        p.y = cy + Math.sin(p.angle) * p.dist;
        p.alpha *= 0.9;
        if (p.dist < 5) p.absorbed = true;
      }
    }

    if (blackHoleProgress >= 1.0) {
      blackHoleActive = false;
      blackHolePhase = 0;
      blackHoleParticles = [];
      blackHoleRadius = 0;
    }
  }
}

export function drawBlackHole() {
  if (!blackHoleActive) return;
  const cx = canvas.width / 2;
  const cy = canvas.height / 2;

  if (blackHoleRadius > 2) {
    const diskRadius = blackHoleRadius * 2.5;
    const diskAlpha = blackHolePhase === 3
      ? Math.max(0, 1 - (blackHoleProgress - 0.75) / 0.25) * 0.15
      : 0.15;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(blackHoleRotation);
    for (let i = 0; i < 4; i++) {
      const armAngle = (i / 4) * Math.PI * 2;
      ctx.beginPath();
      for (let t = 0; t < 1; t += 0.02) {
        const spiralR = blackHoleRadius * 0.8 + t * (diskRadius - blackHoleRadius * 0.8);
        const spiralA = armAngle + t * Math.PI * 1.5;
        const sx = Math.cos(spiralA) * spiralR;
        const sy = Math.sin(spiralA) * spiralR;
        if (t === 0) ctx.moveTo(sx, sy);
        else ctx.lineTo(sx, sy);
      }
      ctx.strokeStyle = rgba(255, 255, 255, diskAlpha * (1 - 0.15 * i));
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    ctx.restore();

    const lensGrad = ctx.createRadialGradient(cx, cy, blackHoleRadius * 0.7, cx, cy, blackHoleRadius * 1.3);
    lensGrad.addColorStop(0, rgba(255, 255, 255, 0));
    lensGrad.addColorStop(0.4, rgba(255, 255, 255, diskAlpha * 0.6));
    lensGrad.addColorStop(0.6, rgba(255, 255, 255, diskAlpha * 0.8));
    lensGrad.addColorStop(1, rgba(255, 255, 255, 0));
    ctx.beginPath();
    ctx.arc(cx, cy, blackHoleRadius * 1.3, 0, Math.PI * 2);
    ctx.fillStyle = lensGrad;
    ctx.fill();

    const holeGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, blackHoleRadius);
    holeGrad.addColorStop(0, rgba(0, 0, 0, 1));
    holeGrad.addColorStop(0.8, rgba(0, 0, 0, 0.95));
    holeGrad.addColorStop(1, rgba(0, 0, 0, 0.3));
    ctx.beginPath();
    ctx.arc(cx, cy, blackHoleRadius, 0, Math.PI * 2);
    ctx.fillStyle = holeGrad;
    ctx.fill();
  }

  for (const p of blackHoleParticles) {
    if (p.absorbed || p.alpha <= 0) continue;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.stretchAngle);
    ctx.scale(p.stretch, 1 / Math.max(p.stretch * 0.5, 0.3));
    ctx.beginPath();
    ctx.arc(0, 0, Math.max(p.size, 0.5), 0, Math.PI * 2);
    ctx.fillStyle = rgba(255, 255, 255, Math.max(p.alpha, 0));
    ctx.fill();
    if (p.size > 1.5) {
      const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, p.size * 2);
      glow.addColorStop(0, rgba(255, 255, 255, p.alpha * 0.3));
      glow.addColorStop(1, rgba(255, 255, 255, 0));
      ctx.beginPath();
      ctx.arc(0, 0, p.size * 2, 0, Math.PI * 2);
      ctx.fillStyle = glow;
      ctx.fill();
    }
    ctx.restore();
  }

  if (blackHolePhase === 2) {
    const absorbProgress = (blackHoleProgress - 0.15) / 0.6;
    const tendrilCount = 6;
    const tendrilReach = blackHoleRadius * 3 * (1 - absorbProgress * 0.5);

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(blackHoleRotation * 0.3);
    for (let i = 0; i < tendrilCount; i++) {
      const tAngle = (i / tendrilCount) * Math.PI * 2;
      const wobble = Math.sin(blackHoleRotation + i * 2.1) * 0.3;
      const endX = Math.cos(tAngle + wobble) * tendrilReach;
      const endY = Math.sin(tAngle + wobble) * tendrilReach;
      const tendrilGrad = ctx.createLinearGradient(0, 0, endX, endY);
      tendrilGrad.addColorStop(0, rgba(0, 0, 0, 0.3 * (1 - absorbProgress)));
      tendrilGrad.addColorStop(1, rgba(0, 0, 0, 0));
      ctx.beginPath();
      ctx.moveTo(0, 0);
      const cpX = endX * 0.5 + Math.cos(tAngle + Math.PI / 2) * tendrilReach * 0.3;
      const cpY = endY * 0.5 + Math.sin(tAngle + Math.PI / 2) * tendrilReach * 0.3;
      ctx.quadraticCurveTo(cpX, cpY, endX, endY);
      ctx.strokeStyle = tendrilGrad;
      ctx.lineWidth = 3 + absorbProgress * 2;
      ctx.stroke();
    }
    ctx.restore();
  }
}

export function resetBlackHole() {
  blackHoleActive = false;
  blackHolePhase = 0;
  blackHoleParticles = [];
  blackHoleRadius = 0;
}
