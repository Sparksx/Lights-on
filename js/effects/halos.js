// === Halos — Shared particle system for clicks, combos, edges, void effects ===
'use strict';

import { state, gameMode, VICTORY_LUMENS } from '../state.js';
import { rgba, easeOutCubic } from '../utils.js';
import { canvas, ctx } from '../canvas.js';

export const halos = [];

export function addHalo(x, y) {
  const progress = Math.min(state.totalLumens / VICTORY_LUMENS, 1);
  const intensity = 0.4 + progress * 0.6;
  const scale = 1 + progress * 2;

  if (gameMode === 'off') {
    // OFF MODE: Void collapse — darkness implodes inward
    halos.push({
      type: 'void-collapse',
      x, y,
      maxRadius: (80 + 40) * scale,
      opacity: intensity * 0.7,
      life: 1.0,
      decay: 0.025,
      delay: 0,
    });

    for (let i = 0; i < 3; i++) {
      halos.push({
        type: 'void-ring',
        x, y,
        maxRadius: (100 + i * 50) * scale,
        opacity: intensity * (0.6 - i * 0.15),
        life: 1.0,
        decay: 0.015 + i * 0.003,
        delay: i * 5,
      });
    }

    halos.push({
      type: 'void-stain',
      x, y,
      maxRadius: 35 * scale,
      opacity: 0.12 + progress * 0.08,
      life: 1.0,
      decay: 0.004,
      delay: 3,
    });

    return;
  }

  // ON MODE: Light spreading outward
  halos.push({
    type: 'glow',
    x, y,
    maxRadius: 25 * scale,
    opacity: intensity,
    life: 1.0,
    decay: 0.035,
    delay: 0,
  });

  for (let i = 0; i < 3; i++) {
    halos.push({
      type: 'ring',
      x, y,
      maxRadius: (80 + i * 40) * scale,
      opacity: intensity * (1 - i * 0.2),
      life: 1.0,
      decay: 0.012 + i * 0.002,
      delay: i * 6,
    });
  }

  halos.push({
    type: 'persist',
    x, y,
    maxRadius: 45 * scale,
    opacity: 0.08 + progress * 0.06,
    life: 1.0,
    decay: 0.003,
    delay: 4,
  });
}

export function updateHalos() {
  for (let i = halos.length - 1; i >= 0; i--) {
    const h = halos[i];

    if (h.delay > 0) {
      h.delay--;
      continue;
    }

    h.life -= h.decay;
    if (h.life <= 0) {
      halos[i] = halos[halos.length - 1];
      halos.pop();
    }
  }
}

export function drawHalos() {
  for (const h of halos) {
    if (h.delay > 0) continue;

    const alpha = h.opacity * Math.max(h.life, 0);
    if (alpha <= 0) continue;

    const t = 1 - h.life;
    const radius = h.maxRadius * easeOutCubic(t);

    if (h.type === 'glow') {
      const r = Math.max(radius, 1);
      const gradient = ctx.createRadialGradient(h.x, h.y, 0, h.x, h.y, r);
      gradient.addColorStop(0, rgba(255, 255, 255, alpha));
      gradient.addColorStop(1, rgba(255, 255, 255, 0));
      ctx.beginPath();
      ctx.arc(h.x, h.y, r, 0, Math.PI * 2);
      ctx.fillStyle = gradient;
      ctx.fill();
    } else if (h.type === 'ring') {
      if (radius < 1) continue;
      const lineWidth = Math.max(0.5, 1.5 * h.life);
      ctx.beginPath();
      ctx.arc(h.x, h.y, radius, 0, Math.PI * 2);
      ctx.strokeStyle = rgba(255, 255, 255, alpha);
      ctx.lineWidth = lineWidth;
      ctx.stroke();
    } else if (h.type === 'persist') {
      const r = h.maxRadius;
      const gradient = ctx.createRadialGradient(h.x, h.y, 0, h.x, h.y, r);
      gradient.addColorStop(0, rgba(255, 255, 255, alpha * 0.7));
      gradient.addColorStop(0.4, rgba(255, 255, 255, alpha * 0.3));
      gradient.addColorStop(1, rgba(255, 255, 255, 0));
      ctx.beginPath();
      ctx.arc(h.x, h.y, r, 0, Math.PI * 2);
      ctx.fillStyle = gradient;
      ctx.fill();
    } else if (h.type === 'combo-text') {
      const floatY = h.y - (1 - h.life) * 40;
      ctx.save();
      ctx.font = 'bold 16px "Courier New", monospace';
      ctx.textAlign = 'center';
      ctx.fillStyle = rgba(255, 255, 255, alpha);
      ctx.fillText(h.text, h.x, floatY);
      ctx.restore();
    } else if (h.type === 'combo-glow') {
      const r = Math.max(h.maxRadius, 1);
      const w = h.warmth || 0;
      const red = 255;
      const green = Math.floor(255 - w * 55);
      const blue = Math.floor(255 - w * 155);
      const gradient = ctx.createRadialGradient(h.x, h.y, 0, h.x, h.y, r);
      gradient.addColorStop(0, rgba(red, green, blue, alpha * 0.8));
      gradient.addColorStop(0.5, rgba(red, green, blue, alpha * 0.3));
      gradient.addColorStop(1, rgba(red, green, blue, 0));
      ctx.beginPath();
      ctx.arc(h.x, h.y, r, 0, Math.PI * 2);
      ctx.fillStyle = gradient;
      ctx.fill();
    } else if (h.type === 'combo-ring') {
      const r = h.maxRadius * easeOutCubic(1 - h.life);
      if (r < 1) continue;
      const w = h.warmth || 0;
      const red = 255;
      const green = Math.floor(255 - w * 55);
      const blue = Math.floor(255 - w * 155);
      const lineWidth = Math.max(0.5, 2 * h.life);
      ctx.beginPath();
      ctx.arc(h.x, h.y, r, 0, Math.PI * 2);
      ctx.strokeStyle = rgba(red, green, blue, alpha);
      ctx.lineWidth = lineWidth;
      ctx.stroke();
    } else if (h.type === 'void-collapse') {
      const collapseT = h.life;
      const r = Math.max(h.maxRadius * collapseT, 1);
      const gradient = ctx.createRadialGradient(h.x, h.y, 0, h.x, h.y, r);
      gradient.addColorStop(0, 'rgba(0, 0, 0, ' + (alpha * 0.9) + ')');
      gradient.addColorStop(0.4, 'rgba(20, 0, 30, ' + (alpha * 0.5) + ')');
      gradient.addColorStop(0.7, 'rgba(40, 0, 50, ' + (alpha * 0.2) + ')');
      gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.beginPath();
      ctx.arc(h.x, h.y, r, 0, Math.PI * 2);
      ctx.fillStyle = gradient;
      ctx.fill();
    } else if (h.type === 'void-ring') {
      const r = Math.max(h.maxRadius * h.life, 1);
      const lineWidth = Math.max(0.5, 2 * (1 - h.life));
      ctx.beginPath();
      ctx.arc(h.x, h.y, r, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(30, 0, 40, ' + alpha + ')';
      ctx.lineWidth = lineWidth;
      ctx.stroke();
    } else if (h.type === 'void-stain') {
      const r = h.maxRadius;
      const gradient = ctx.createRadialGradient(h.x, h.y, 0, h.x, h.y, r);
      gradient.addColorStop(0, 'rgba(0, 0, 0, ' + (alpha * 0.5) + ')');
      gradient.addColorStop(0.5, 'rgba(10, 0, 15, ' + (alpha * 0.2) + ')');
      gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.beginPath();
      ctx.arc(h.x, h.y, r, 0, Math.PI * 2);
      ctx.fillStyle = gradient;
      ctx.fill();
    } else if (h.type === 'void-crack') {
      if (h.points && h.points.length >= 2) {
        const crackAlpha = alpha * 0.9;
        ctx.beginPath();
        ctx.moveTo(h.points[0].x, h.points[0].y);
        for (let pi = 1; pi < h.points.length; pi++) {
          ctx.lineTo(h.points[pi].x, h.points[pi].y);
        }
        ctx.strokeStyle = 'rgba(0, 0, 0, ' + crackAlpha + ')';
        ctx.lineWidth = h.crackWidth || 2;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(h.points[0].x, h.points[0].y);
        for (let pi = 1; pi < h.points.length; pi++) {
          ctx.lineTo(h.points[pi].x, h.points[pi].y);
        }
        ctx.strokeStyle = 'rgba(60, 0, 80, ' + (crackAlpha * 0.4) + ')';
        ctx.lineWidth = (h.crackWidth || 2) * 5;
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(h.points[0].x, h.points[0].y);
        for (let pi = 1; pi < h.points.length; pi++) {
          ctx.lineTo(h.points[pi].x, h.points[pi].y);
        }
        ctx.strokeStyle = 'rgba(40, 0, 60, ' + (crackAlpha * 0.12) + ')';
        ctx.lineWidth = (h.crackWidth || 2) * 12;
        ctx.stroke();
      }
    } else if (h.type === 'void-implode') {
      const r = Math.max(h.maxRadius * h.life, 0);
      if (r > 1) {
        const gradient = ctx.createRadialGradient(h.x, h.y, r * 0.8, h.x, h.y, r);
        gradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
        gradient.addColorStop(0.5, 'rgba(20, 0, 30, ' + (alpha * 0.6) + ')');
        gradient.addColorStop(1, 'rgba(0, 0, 0, ' + (alpha * 0.3) + ')');
        ctx.beginPath();
        ctx.arc(h.x, h.y, r, 0, Math.PI * 2);
        ctx.fillStyle = gradient;
        ctx.fill();
      }
      const coreR = h.maxRadius * (1 - h.life) * 0.3;
      if (coreR > 0.5) {
        const coreGrad = ctx.createRadialGradient(h.x, h.y, 0, h.x, h.y, coreR);
        coreGrad.addColorStop(0, 'rgba(0, 0, 0, ' + (alpha * 0.8) + ')');
        coreGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.beginPath();
        ctx.arc(h.x, h.y, coreR, 0, Math.PI * 2);
        ctx.fillStyle = coreGrad;
        ctx.fill();
      }
    } else if (h.type === 'cold-glow') {
      const r = Math.max(radius, 1);
      const coldness = h.warmth || 0;
      const rr = Math.floor(30 + coldness * 30);
      const gg = 0;
      const bb = Math.floor(60 + coldness * 100);
      const gradient = ctx.createRadialGradient(h.x, h.y, 0, h.x, h.y, r);
      gradient.addColorStop(0, 'rgba(' + rr + ', ' + gg + ', ' + bb + ', ' + (alpha * 0.7) + ')');
      gradient.addColorStop(0.5, 'rgba(' + rr + ', ' + gg + ', ' + bb + ', ' + (alpha * 0.25) + ')');
      gradient.addColorStop(1, 'rgba(' + rr + ', ' + gg + ', ' + bb + ', 0)');
      ctx.beginPath();
      ctx.arc(h.x, h.y, r, 0, Math.PI * 2);
      ctx.fillStyle = gradient;
      ctx.fill();
    } else if (h.type === 'cold-ring') {
      const r = h.maxRadius * h.life;
      if (r < 1) continue;
      const coldness = h.warmth || 0;
      const rr = Math.floor(30 + coldness * 30);
      const bb = Math.floor(60 + coldness * 100);
      const lineWidth = Math.max(0.5, 2.5 * (1 - h.life));
      ctx.beginPath();
      ctx.arc(h.x, h.y, r, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(' + rr + ', 0, ' + bb + ', ' + alpha + ')';
      ctx.lineWidth = lineWidth;
      ctx.stroke();
    } else if (h.type === 'screen-darken') {
      ctx.fillStyle = 'rgba(0, 0, 0, ' + alpha + ')';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    } else if (h.type === 'screen-flash') {
      ctx.fillStyle = rgba(255, 255, 255, alpha);
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    } else if (h.type === 'edge-dark') {
      const w = canvas.width;
      const ht = canvas.height;
      const thickness = h.maxRadius;
      const topG = ctx.createLinearGradient(0, 0, 0, thickness);
      topG.addColorStop(0, 'rgba(0, 0, 0, ' + alpha + ')');
      topG.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = topG;
      ctx.fillRect(0, 0, w, thickness);
      const botG = ctx.createLinearGradient(0, ht, 0, ht - thickness);
      botG.addColorStop(0, 'rgba(0, 0, 0, ' + alpha + ')');
      botG.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = botG;
      ctx.fillRect(0, ht - thickness, w, thickness);
      const leftG = ctx.createLinearGradient(0, 0, thickness, 0);
      leftG.addColorStop(0, 'rgba(0, 0, 0, ' + alpha + ')');
      leftG.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = leftG;
      ctx.fillRect(0, 0, thickness, ht);
      const rightG = ctx.createLinearGradient(w, 0, w - thickness, 0);
      rightG.addColorStop(0, 'rgba(0, 0, 0, ' + alpha + ')');
      rightG.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = rightG;
      ctx.fillRect(w - thickness, 0, thickness, ht);
    } else if (h.type === 'edge') {
      const w = canvas.width;
      const ht = canvas.height;
      const thickness = h.maxRadius;
      const topG = ctx.createLinearGradient(0, 0, 0, thickness);
      topG.addColorStop(0, rgba(255, 255, 255, alpha));
      topG.addColorStop(1, rgba(255, 255, 255, 0));
      ctx.fillStyle = topG;
      ctx.fillRect(0, 0, w, thickness);
      const botG = ctx.createLinearGradient(0, ht, 0, ht - thickness);
      botG.addColorStop(0, rgba(255, 255, 255, alpha));
      botG.addColorStop(1, rgba(255, 255, 255, 0));
      ctx.fillStyle = botG;
      ctx.fillRect(0, ht - thickness, w, thickness);
      const leftG = ctx.createLinearGradient(0, 0, thickness, 0);
      leftG.addColorStop(0, rgba(255, 255, 255, alpha));
      leftG.addColorStop(1, rgba(255, 255, 255, 0));
      ctx.fillStyle = leftG;
      ctx.fillRect(0, 0, thickness, ht);
      const rightG = ctx.createLinearGradient(w, 0, w - thickness, 0);
      rightG.addColorStop(0, rgba(255, 255, 255, alpha));
      rightG.addColorStop(1, rgba(255, 255, 255, 0));
      ctx.fillStyle = rightG;
      ctx.fillRect(w - thickness, 0, thickness, ht);
    }
  }
}

// --- Edge glow (upgrade reward) ---
export function addEdgeGlow() {
  if (gameMode === 'off') {
    halos.push({
      type: 'edge-dark',
      x: 0, y: 0,
      maxRadius: 120,
      opacity: 0.12,
      life: 1.0,
      decay: 0.008,
      delay: 0,
    });
  } else {
    halos.push({
      type: 'edge',
      x: 0, y: 0,
      maxRadius: 100,
      opacity: 0.10,
      life: 1.0,
      decay: 0.008,
      delay: 0,
    });
  }
}

export function resetHalos() {
  halos.length = 0;
}
