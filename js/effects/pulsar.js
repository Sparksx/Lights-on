// === Pulsar — Spinning star system (upgrade #11) ===
'use strict';

import { gameMode, getUpgradeCount, shared } from '../state.js';
import { rgba } from '../utils.js';
import { ctx } from '../canvas.js';

let pulsarAngle = 0;

export function updatePulsar() {
  const pulsarCount = getUpgradeCount('pulsar');
  if (pulsarCount === 0) return;
  pulsarAngle += 0.15 + pulsarCount * 0.02;
}

export function drawPulsar() {
  const pulsarCount = getUpgradeCount('pulsar');
  if (pulsarCount === 0) return;

  const mouseX = shared.mouseX;
  const mouseY = shared.mouseY;
  const orbitCount = Math.min(1 + Math.floor(pulsarCount / 3), 4);
  const orbitRadius = 30 + pulsarCount * 2;

  if (gameMode === 'off') {
    const coreR = 8 + pulsarCount;
    const coreGrad = ctx.createRadialGradient(mouseX, mouseY, 0, mouseX, mouseY, coreR);
    coreGrad.addColorStop(0, 'rgba(0, 0, 0, 0.7)');
    coreGrad.addColorStop(0.6, 'rgba(20, 0, 30, 0.3)');
    coreGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.beginPath();
    ctx.arc(mouseX, mouseY, coreR, 0, Math.PI * 2);
    ctx.fillStyle = coreGrad;
    ctx.fill();

    ctx.save();
    ctx.translate(mouseX, mouseY);
    ctx.rotate(-pulsarAngle * 0.7);
    const armCount = orbitCount + 2;
    for (let i = 0; i < armCount; i++) {
      const baseAngle = (i / armCount) * Math.PI * 2;
      ctx.beginPath();
      for (let t = 0; t < 1; t += 0.03) {
        const spiralR = coreR * 0.5 + t * (orbitRadius * 1.5);
        const spiralA = baseAngle + t * Math.PI * 2.5;
        const sx = Math.cos(spiralA) * spiralR;
        const sy = Math.sin(spiralA) * spiralR;
        if (t === 0) ctx.moveTo(sx, sy);
        else ctx.lineTo(sx, sy);
      }
      const armAlpha = 0.3 + pulsarCount * 0.02;
      ctx.strokeStyle = 'rgba(0, 0, 0, ' + armAlpha + ')';
      ctx.lineWidth = 1.5 + pulsarCount * 0.15;
      ctx.stroke();
    }
    ctx.restore();

    for (let i = 0; i < orbitCount; i++) {
      const angleOffset = (i / orbitCount) * Math.PI * 2;
      const angle = -pulsarAngle + angleOffset;

      const trailCount = 7;
      for (let t = trailCount; t >= 0; t--) {
        const trailAngle = angle + t * 0.15;
        const tx = mouseX + Math.cos(trailAngle) * orbitRadius;
        const ty = mouseY + Math.sin(trailAngle) * orbitRadius;
        const trailAlpha = (1 - t / trailCount) * 0.5;
        const trailSize = (1 - t / trailCount) * 3;
        ctx.beginPath();
        ctx.arc(tx, ty, trailSize, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(0, 0, 0, ' + trailAlpha + ')';
        ctx.fill();
      }

      const px = mouseX + Math.cos(angle) * orbitRadius;
      const py = mouseY + Math.sin(angle) * orbitRadius;

      ctx.beginPath();
      ctx.arc(px, py, 3, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
      ctx.fill();

      const glow = ctx.createRadialGradient(px, py, 0, px, py, 10);
      glow.addColorStop(0, 'rgba(40, 0, 60, 0.4)');
      glow.addColorStop(1, 'rgba(20, 0, 30, 0)');
      ctx.beginPath();
      ctx.arc(px, py, 10, 0, Math.PI * 2);
      ctx.fillStyle = glow;
      ctx.fill();
    }

    const distortR = orbitRadius * 1.8;
    ctx.beginPath();
    ctx.arc(mouseX, mouseY, distortR, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.06)';
    ctx.lineWidth = 1;
    ctx.stroke();

    return;
  }

  // ON MODE
  for (let i = 0; i < orbitCount; i++) {
    const angleOffset = (i / orbitCount) * Math.PI * 2;
    const angle = pulsarAngle + angleOffset;
    const px = mouseX + Math.cos(angle) * orbitRadius;
    const py = mouseY + Math.sin(angle) * orbitRadius;

    const trailCount = 5;
    for (let t = trailCount; t >= 0; t--) {
      const trailAngle = angle - t * 0.12;
      const tx = mouseX + Math.cos(trailAngle) * orbitRadius;
      const ty = mouseY + Math.sin(trailAngle) * orbitRadius;
      const trailAlpha = (1 - t / trailCount) * 0.6;
      const trailSize = (1 - t / trailCount) * 3;
      ctx.beginPath();
      ctx.arc(tx, ty, trailSize, 0, Math.PI * 2);
      ctx.fillStyle = rgba(200, 220, 255, trailAlpha);
      ctx.fill();
    }

    ctx.beginPath();
    ctx.arc(px, py, 3, 0, Math.PI * 2);
    ctx.fillStyle = rgba(255, 255, 255, 0.9);
    ctx.fill();

    const glow = ctx.createRadialGradient(px, py, 0, px, py, 12);
    glow.addColorStop(0, rgba(200, 220, 255, 0.4));
    glow.addColorStop(1, rgba(200, 220, 255, 0));
    ctx.beginPath();
    ctx.arc(px, py, 12, 0, Math.PI * 2);
    ctx.fillStyle = glow;
    ctx.fill();

    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(angle * 2);
    ctx.beginPath();
    const spikes = 4;
    const outerR = 5 + pulsarCount * 0.3;
    const innerR = 1.5;
    for (let s = 0; s < spikes * 2; s++) {
      const r = s % 2 === 0 ? outerR : innerR;
      const a = (s / (spikes * 2)) * Math.PI * 2;
      if (s === 0) ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
      else ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    ctx.closePath();
    ctx.fillStyle = rgba(255, 255, 255, 0.7);
    ctx.fill();
    ctx.restore();
  }
}
