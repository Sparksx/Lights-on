// === Lightning — Lightning bolt / Fissure system ===
'use strict';

import { gameMode, getUpgradeCount } from '../state.js';
import { rgba } from '../utils.js';
import { canvas, ctx } from '../canvas.js';
import { halos } from './halos.js';

export const lightningBolts = [];

function generateBoltPath(x1, y1, x2, y2, detail, jitter) {
  const points = [{ x: x1, y: y1 }];
  const dx = x2 - x1;
  const dy = y2 - y1;
  const segments = detail || 8;
  for (let i = 1; i < segments; i++) {
    const t = i / segments;
    const offsetX = (Math.random() - 0.5) * jitter;
    const offsetY = (Math.random() - 0.5) * jitter * 0.3;
    points.push({ x: x1 + dx * t + offsetX, y: y1 + dy * t + offsetY });
  }
  points.push({ x: x2, y: y2 });
  return points;
}

export function spawnLightningBolt(clickX, clickY, lightningCount, delay) {
  const intensity = Math.min(0.5 + lightningCount * 0.08, 1.2);
  const startSide = Math.random();
  let startX, startY;
  if (startSide < 0.6) {
    startX = clickX + (Math.random() - 0.5) * canvas.width * 0.4;
    startY = -10;
  } else if (startSide < 0.8) {
    startX = -10;
    startY = Math.random() * canvas.height * 0.4;
  } else {
    startX = canvas.width + 10;
    startY = Math.random() * canvas.height * 0.4;
  }

  const jitter = 80 + lightningCount * 10;
  const segments = 8 + Math.floor(lightningCount / 2);
  const mainPath = generateBoltPath(startX, startY, clickX, clickY, segments, jitter);

  const branches = [];
  const branchCount = Math.min(1 + Math.floor(lightningCount / 3), 5);
  for (let b = 0; b < branchCount; b++) {
    const branchIdx = 2 + Math.floor(Math.random() * (mainPath.length - 3));
    const branchStart = mainPath[branchIdx];
    const branchAngle = Math.atan2(clickY - startY, clickX - startX) + (Math.random() - 0.5) * 1.5;
    const branchLen = 40 + Math.random() * 80 * intensity;
    const branchEnd = {
      x: branchStart.x + Math.cos(branchAngle) * branchLen,
      y: branchStart.y + Math.sin(branchAngle) * branchLen,
    };
    branches.push(generateBoltPath(branchStart.x, branchStart.y, branchEnd.x, branchEnd.y, 4, jitter * 0.5));
  }

  lightningBolts.push({
    mainPath: mainPath,
    branches: branches,
    life: 1.0,
    decay: 0.035,
    intensity: intensity,
    delay: delay || 0,
    glowWidth: 3 + lightningCount * 0.5,
  });

  halos.push({
    type: 'glow',
    x: clickX,
    y: clickY,
    maxRadius: 50 * intensity,
    opacity: 0.7 * intensity,
    life: 1.0,
    decay: 0.03,
    delay: delay || 0,
  });
}

export function spawnFissureCrack(clickX, clickY, count, delay) {
  const intensity = Math.min(0.6 + count * 0.08, 1.2);
  const crackAngle = Math.random() * Math.PI * 2;
  const crackLen = 80 + Math.random() * 120 + count * 15;
  const endX = clickX + Math.cos(crackAngle) * crackLen;
  const endY = clickY + Math.sin(crackAngle) * crackLen;

  const segments = 6 + Math.floor(count / 2);
  const jitter = 30 + count * 5;
  const points = [{ x: clickX, y: clickY }];
  const dx = endX - clickX;
  const dy = endY - clickY;
  for (let i = 1; i < segments; i++) {
    const t = i / segments;
    points.push({
      x: clickX + dx * t + (Math.random() - 0.5) * jitter,
      y: clickY + dy * t + (Math.random() - 0.5) * jitter * 0.5,
    });
  }
  points.push({ x: endX, y: endY });

  halos.push({
    type: 'void-crack',
    x: clickX,
    y: clickY,
    maxRadius: crackLen,
    opacity: intensity * 0.9,
    life: 1.0,
    decay: 0.02,
    delay: delay || 0,
    points: points,
    crackWidth: 2 + count * 0.4,
  });

  const branchCount = Math.min(1 + Math.floor(count / 4), 3);
  for (let b = 0; b < branchCount; b++) {
    const branchIdx = 1 + Math.floor(Math.random() * (segments - 1));
    const branchPt = points[branchIdx];
    const branchAngle = crackAngle + (Math.random() - 0.5) * 1.5;
    const branchLen = 20 + Math.random() * 50;
    const branchEnd = {
      x: branchPt.x + Math.cos(branchAngle) * branchLen,
      y: branchPt.y + Math.sin(branchAngle) * branchLen,
    };
    const branchPoints = [branchPt];
    for (let s = 1; s < 3; s++) {
      const bt = s / 3;
      branchPoints.push({
        x: branchPt.x + (branchEnd.x - branchPt.x) * bt + (Math.random() - 0.5) * jitter * 0.3,
        y: branchPt.y + (branchEnd.y - branchPt.y) * bt + (Math.random() - 0.5) * jitter * 0.3,
      });
    }
    branchPoints.push(branchEnd);
    halos.push({
      type: 'void-crack',
      x: branchPt.x,
      y: branchPt.y,
      maxRadius: branchLen,
      opacity: intensity * 0.5,
      life: 1.0,
      decay: 0.025,
      delay: (delay || 0) + 2,
      points: branchPoints,
      crackWidth: 1 + count * 0.2,
    });
  }

  halos.push({
    type: 'void-collapse',
    x: clickX,
    y: clickY,
    maxRadius: 40 * intensity,
    opacity: 0.6 * intensity,
    life: 1.0,
    decay: 0.025,
    delay: delay || 0,
  });
}

export function updateLightningBolts() {
  for (let i = lightningBolts.length - 1; i >= 0; i--) {
    const bolt = lightningBolts[i];
    if (bolt.delay > 0) {
      bolt.delay--;
      continue;
    }
    bolt.life -= bolt.decay;
    if (bolt.life <= 0) {
      lightningBolts[i] = lightningBolts[lightningBolts.length - 1];
      lightningBolts.pop();
    }
  }
}

function drawBoltPath(points, alpha, width) {
  if (points.length < 2) return;
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) {
    ctx.lineTo(points[i].x, points[i].y);
  }
  ctx.strokeStyle = rgba(255, 255, 255, alpha);
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) {
    ctx.lineTo(points[i].x, points[i].y);
  }
  ctx.strokeStyle = rgba(200, 220, 255, alpha * 0.4);
  ctx.lineWidth = width * 4;
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) {
    ctx.lineTo(points[i].x, points[i].y);
  }
  ctx.strokeStyle = rgba(180, 200, 255, alpha * 0.12);
  ctx.lineWidth = width * 10;
  ctx.stroke();
}

export function drawLightningBolts() {
  for (const bolt of lightningBolts) {
    if (bolt.delay > 0) continue;
    const flicker = 0.7 + Math.random() * 0.3;
    const alpha = Math.max(bolt.life, 0) * bolt.intensity * flicker;
    if (alpha <= 0) continue;
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    drawBoltPath(bolt.mainPath, alpha, bolt.glowWidth);
    for (const branch of bolt.branches) {
      drawBoltPath(branch, alpha * 0.6, bolt.glowWidth * 0.5);
    }
    ctx.restore();
  }
}

export function resetLightningBolts() {
  lightningBolts.length = 0;
}
