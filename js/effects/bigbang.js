// === Big Bang — Explosion effect system (upgrade #20, ON mode) ===
'use strict';

import { state, gameMode, getUpgradeCount } from '../state.js';
import { rgba, _now, easeOutCubic } from '../utils.js';
import { canvas, ctx } from '../canvas.js';
import { halos } from './halos.js';
import { bgStars } from './stars.js';
import { lightBursts } from './bursts.js';

let bigBangActive = false;
let bigBangPhase = 0;
let bigBangProgress = 0;
let bigBangParticles = [];
let nextBigBangTime = _now() + 30000 + Math.random() * 30000;

export function checkBigBangSpawn() {
  if (gameMode === 'off') return;
  const bbCount = getUpgradeCount('bigbang');
  if (bbCount === 0) return;
  if (bigBangActive) return;
  if (state.victoryReached || state.sunPurchased) return;
  if (_now() < nextBigBangTime) return;

  startBigBang();
  const interval = Math.max(15000, 40000 - bbCount * 3000);
  nextBigBangTime = _now() + interval + Math.random() * interval * 0.5;
}

function startBigBang() {
  bigBangActive = true;
  bigBangPhase = 1;
  bigBangProgress = 0;
  bigBangParticles = [];

  const cx = canvas.width / 2;
  const cy = canvas.height / 2;

  let hasLight = false;
  for (const h of halos) {
    if ((h.type === 'glow' || h.type === 'persist') && h.life > 0.1) {
      hasLight = true;
      bigBangParticles.push({
        x: h.x,
        y: h.y,
        originX: h.x,
        originY: h.y,
        targetX: cx,
        targetY: cy,
        size: 2 + Math.random() * 4,
        alpha: 0.5 + Math.random() * 0.5,
        phase: 0,
        explosionAngle: Math.random() * Math.PI * 2,
        explosionDist: 100 + Math.random() * Math.max(canvas.width, canvas.height) * 0.7,
      });
    }
  }

  for (const b of lightBursts) {
    hasLight = true;
    bigBangParticles.push({
      x: b.x,
      y: b.y,
      originX: b.x,
      originY: b.y,
      targetX: cx,
      targetY: cy,
      size: 3 + Math.random() * 5,
      alpha: 0.6 + Math.random() * 0.4,
      phase: 0,
      explosionAngle: Math.random() * Math.PI * 2,
      explosionDist: 100 + Math.random() * Math.max(canvas.width, canvas.height) * 0.7,
    });
  }

  for (const s of bgStars) {
    bigBangParticles.push({
      x: s.x,
      y: s.y,
      originX: s.x,
      originY: s.y,
      targetX: cx,
      targetY: cy,
      size: s.size + 1,
      alpha: 0.3 + Math.random() * 0.5,
      phase: 0,
      explosionAngle: Math.random() * Math.PI * 2,
      explosionDist: 80 + Math.random() * Math.max(canvas.width, canvas.height) * 0.6,
    });
  }

  if (!hasLight || bigBangParticles.length < 20) {
    const edgeCount = 40;
    for (let i = 0; i < edgeCount; i++) {
      let ex, ey;
      const side = Math.floor(Math.random() * 4);
      if (side === 0) {
        ex = Math.random() * canvas.width;
        ey = -5;
      } else if (side === 1) {
        ex = canvas.width + 5;
        ey = Math.random() * canvas.height;
      } else if (side === 2) {
        ex = Math.random() * canvas.width;
        ey = canvas.height + 5;
      } else {
        ex = -5;
        ey = Math.random() * canvas.height;
      }
      bigBangParticles.push({
        x: ex,
        y: ey,
        originX: ex,
        originY: ey,
        targetX: cx,
        targetY: cy,
        size: 1 + Math.random() * 3,
        alpha: 0.3 + Math.random() * 0.5,
        phase: 0,
        explosionAngle: Math.random() * Math.PI * 2,
        explosionDist: 100 + Math.random() * Math.max(canvas.width, canvas.height) * 0.7,
      });
    }
  }
}

export function updateBigBang() {
  if (!bigBangActive) return;

  bigBangProgress += 0.012;
  const cx = canvas.width / 2;
  const cy = canvas.height / 2;

  if (bigBangPhase === 1) {
    for (const p of bigBangParticles) {
      p.phase = Math.min(bigBangProgress / 0.5, 1);
      const t = easeOutCubic(p.phase);
      p.x = p.originX + (p.targetX - p.originX) * t;
      p.y = p.originY + (p.targetY - p.originY) * t;
      p.size *= 0.998;
    }

    if (bigBangProgress >= 0.5) {
      bigBangPhase = 2;
      bigBangProgress = 0.5;
      for (const p of bigBangParticles) {
        p.phase = 0;
        p.originX = cx;
        p.originY = cy;
        p.x = cx;
        p.y = cy;
        p.size = 2 + Math.random() * 5;
        p.alpha = 0.7 + Math.random() * 0.3;
      }
    }
  } else if (bigBangPhase === 2) {
    const explodeProgress = (bigBangProgress - 0.5) / 0.5;
    for (const p of bigBangParticles) {
      p.phase = Math.min(explodeProgress, 1);
      const t = easeOutCubic(p.phase);
      p.x = cx + Math.cos(p.explosionAngle) * p.explosionDist * t;
      p.y = cy + Math.sin(p.explosionAngle) * p.explosionDist * t;
      p.alpha = (1 - p.phase) * 0.8;
      p.size = (2 + Math.random() * 3) * (1 - p.phase * 0.5);
    }

    if (bigBangProgress >= 1.0) {
      bigBangActive = false;
      bigBangPhase = 0;
      bigBangParticles = [];
    }
  }
}

export function drawBigBang() {
  if (!bigBangActive) return;
  const cx = canvas.width / 2;
  const cy = canvas.height / 2;

  for (const p of bigBangParticles) {
    if (p.alpha <= 0) continue;
    ctx.beginPath();
    ctx.arc(p.x, p.y, Math.max(p.size, 0.5), 0, Math.PI * 2);
    ctx.fillStyle = rgba(255, 255, 255, Math.max(p.alpha, 0));
    ctx.fill();
  }

  if (bigBangPhase === 1) {
    const intensity = bigBangProgress / 0.5;
    const r = 20 + intensity * 40;
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    grad.addColorStop(0, rgba(255, 255, 255, intensity * 0.8));
    grad.addColorStop(1, rgba(255, 255, 255, 0));
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();
  } else if (bigBangPhase === 2) {
    const explodeProgress = (bigBangProgress - 0.5) / 0.5;
    const intensity = 1 - explodeProgress;
    const flashR = 50 + explodeProgress * 200;
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, flashR);
    grad.addColorStop(0, rgba(255, 255, 240, intensity * 0.9));
    grad.addColorStop(0.3, rgba(255, 255, 220, intensity * 0.4));
    grad.addColorStop(1, rgba(255, 255, 200, 0));
    ctx.beginPath();
    ctx.arc(cx, cy, flashR, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();

    if (explodeProgress < 0.6) {
      const ringR = explodeProgress * Math.max(canvas.width, canvas.height);
      ctx.beginPath();
      ctx.arc(cx, cy, ringR, 0, Math.PI * 2);
      ctx.strokeStyle = rgba(255, 255, 255, (1 - explodeProgress / 0.6) * 0.4);
      ctx.lineWidth = 3;
      ctx.stroke();
    }
  }
}

export function resetBigBang() {
  bigBangActive = false;
  bigBangPhase = 0;
  bigBangParticles = [];
}
