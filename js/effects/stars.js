// === Stars — Background star system (Star upgrade) ===
'use strict';

import { gameMode, getUpgradeCount } from '../state.js';
import { rgba } from '../utils.js';
import { canvas, ctx } from '../canvas.js';

export const bgStars = [];
let lastStarCount = 0;

export function regenerateStars() {
  const starCount = getUpgradeCount('star');
  if (starCount === lastStarCount && bgStars.length > 0) return;
  lastStarCount = starCount;
  bgStars.length = 0;
  const total = starCount * 8;
  for (let i = 0; i < total; i++) {
    bgStars.push({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      size: 0.5 + Math.random() * 1.5,
      baseAlpha: 0.15 + Math.random() * 0.4,
      twinkleSpeed: 0.01 + Math.random() * 0.03,
      twinklePhase: Math.random() * Math.PI * 2,
      constellationId: -1,
      constellationIdx: -1,
    });
  }
}

export function updateStars() {
  for (const s of bgStars) {
    s.twinklePhase += s.twinkleSpeed;
  }
}

export function drawStars() {
  const starCount = getUpgradeCount('star');
  if (starCount === 0) return;

  if (gameMode === 'off') {
    for (const s of bgStars) {
      const twinkle = 0.5 + 0.5 * Math.sin(s.twinklePhase);
      const alpha = s.baseAlpha * twinkle * 0.6;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.size * 0.8, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0, 0, 0, ' + alpha + ')';
      ctx.fill();
      if (s.size > 1) {
        const aura = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, s.size * 2.5);
        aura.addColorStop(0, 'rgba(0, 0, 0, ' + alpha * 0.2 + ')');
        aura.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.size * 2.5, 0, Math.PI * 2);
        ctx.fillStyle = aura;
        ctx.fill();
      }
    }
  } else {
    for (const s of bgStars) {
      const twinkle = 0.5 + 0.5 * Math.sin(s.twinklePhase);
      const alpha = s.baseAlpha * twinkle;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
      ctx.fillStyle = rgba(255, 255, 255, alpha);
      ctx.fill();
    }
  }
}

export function resetStars() {
  bgStars.length = 0;
  lastStarCount = 0;
}
