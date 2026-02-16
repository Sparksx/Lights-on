// === Constellations — Constellation tracing system (upgrade #16) ===
'use strict';

import { state, gameMode, getUpgradeCount } from '../state.js';
import { rgba, _now } from '../utils.js';
import { canvas, ctx } from '../canvas.js';
import { halos } from './halos.js';

// Known constellation patterns (normalized 0-1 coordinates)
const CONSTELLATION_TEMPLATES = [
  { name: 'Ursa Major', stars: [{x:0.0,y:0.4},{x:0.15,y:0.25},{x:0.3,y:0.2},{x:0.45,y:0.25},{x:0.55,y:0.4},{x:0.7,y:0.55},{x:0.85,y:0.5}], edges: [[0,1],[1,2],[2,3],[3,4],[4,5],[5,6],[6,3]] },
  { name: 'Orion', stars: [{x:0.3,y:0.0},{x:0.7,y:0.05},{x:0.2,y:0.35},{x:0.5,y:0.4},{x:0.8,y:0.35},{x:0.5,y:0.5},{x:0.35,y:0.7},{x:0.5,y:0.65},{x:0.65,y:0.7},{x:0.25,y:1.0},{x:0.75,y:1.0}], edges: [[0,2],[1,4],[2,3],[3,4],[2,5],[4,5],[5,6],[5,8],[6,7],[7,8],[6,9],[8,10]] },
  { name: 'Cassiopeia', stars: [{x:0.0,y:0.6},{x:0.25,y:0.2},{x:0.5,y:0.5},{x:0.75,y:0.15},{x:1.0,y:0.55}], edges: [[0,1],[1,2],[2,3],[3,4]] },
  { name: 'Cygnus', stars: [{x:0.5,y:0.0},{x:0.5,y:0.3},{x:0.5,y:0.6},{x:0.5,y:1.0},{x:0.15,y:0.45},{x:0.85,y:0.45}], edges: [[0,1],[1,2],[2,3],[4,2],[2,5]] },
  { name: 'Leo', stars: [{x:0.3,y:0.0},{x:0.15,y:0.2},{x:0.0,y:0.45},{x:0.2,y:0.55},{x:0.35,y:0.35},{x:0.5,y:0.25},{x:0.85,y:0.3},{x:1.0,y:0.55},{x:0.7,y:0.6}], edges: [[0,1],[1,2],[2,3],[3,4],[4,0],[0,5],[5,6],[6,7],[7,8],[8,6]] },
  { name: 'Scorpius', stars: [{x:0.2,y:0.0},{x:0.25,y:0.15},{x:0.3,y:0.3},{x:0.4,y:0.45},{x:0.5,y:0.55},{x:0.6,y:0.65},{x:0.7,y:0.75},{x:0.8,y:0.85},{x:0.9,y:0.9},{x:1.0,y:0.85}], edges: [[0,1],[1,2],[2,3],[3,4],[4,5],[5,6],[6,7],[7,8],[8,9]] },
  { name: 'Lyra', stars: [{x:0.5,y:0.0},{x:0.3,y:0.4},{x:0.7,y:0.4},{x:0.25,y:0.8},{x:0.75,y:0.8}], edges: [[0,1],[0,2],[1,2],[1,3],[2,4],[3,4]] },
  { name: 'Gemini', stars: [{x:0.3,y:0.0},{x:0.7,y:0.0},{x:0.25,y:0.3},{x:0.75,y:0.3},{x:0.2,y:0.6},{x:0.8,y:0.6},{x:0.3,y:0.9},{x:0.7,y:0.9}], edges: [[0,1],[0,2],[1,3],[2,4],[3,5],[4,6],[5,7],[2,3]] },
];

export const activeConstellations = [];
let nextConstellationTime = _now() + 5000;
let constellationDragActive = false;
let constellationDragPath = [];

function spawnConstellation() {
  const constellationCount = getUpgradeCount('constellation');
  if (constellationCount === 0) return;
  if (activeConstellations.length >= Math.min(2 + Math.floor(constellationCount / 2), 5)) return;

  const usedNames = activeConstellations.map(function(c) { return c.name; });
  const available = CONSTELLATION_TEMPLATES.filter(function(t) { return usedNames.indexOf(t.name) === -1; });
  if (available.length === 0) return;

  const template = available[Math.floor(Math.random() * available.length)];

  const padding = 100;
  const size = 120 + constellationCount * 15;
  const areaX = padding + Math.random() * (canvas.width - padding * 2 - size);
  const areaY = padding + Math.random() * (canvas.height - padding * 2 - size);

  const placedStars = template.stars.map(function(s) {
    return { x: areaX + s.x * size, y: areaY + s.y * size, traced: false };
  });

  activeConstellations.push({
    name: template.name,
    stars: placedStars,
    edges: template.edges.map(function(e) { return { from: e[0], to: e[1], traced: false }; }),
    life: 1.0,
    completed: false,
    completedTime: 0,
    sparklePhase: 0,
  });
}

export function checkConstellationSpawn() {
  if (getUpgradeCount('constellation') === 0) return;
  if (getUpgradeCount('star') === 0) return;
  if (_now() < nextConstellationTime) return;
  spawnConstellation();
  const constellationCount = getUpgradeCount('constellation');
  const interval = Math.max(8000, 20000 - constellationCount * 1500);
  nextConstellationTime = _now() + interval + Math.random() * interval * 0.5;
}

export function updateConstellations() {
  for (let i = activeConstellations.length - 1; i >= 0; i--) {
    const c = activeConstellations[i];
    if (c.completed) {
      c.completedTime++;
      c.sparklePhase += 0.1;
      c.life -= 0.008;
      if (c.life <= 0) {
        activeConstellations.splice(i, 1);
      }
    }
  }
}

export function drawConstellations() {
  if (getUpgradeCount('constellation') === 0) return;

  const isOff = gameMode === 'off';

  for (const c of activeConstellations) {
    const alpha = Math.min(c.life, 1.0);
    if (alpha <= 0) continue;

    // Draw edges
    for (const edge of c.edges) {
      const s1 = c.stars[edge.from];
      const s2 = c.stars[edge.to];
      ctx.beginPath();
      ctx.moveTo(s1.x, s1.y);
      ctx.lineTo(s2.x, s2.y);
      if (isOff) {
        if (edge.traced || c.completed) {
          ctx.strokeStyle = 'rgba(0, 0, 0, ' + (alpha * 0.5) + ')';
          ctx.lineWidth = 1.5;
          ctx.setLineDash([3, 3]);
        } else {
          ctx.strokeStyle = 'rgba(0, 0, 0, ' + (alpha * 0.06) + ')';
          ctx.lineWidth = 0.5;
          ctx.setLineDash([2, 6]);
        }
      } else {
        if (edge.traced || c.completed) {
          ctx.strokeStyle = rgba(200, 220, 255, alpha * 0.6);
          ctx.lineWidth = 1.5;
        } else {
          ctx.strokeStyle = rgba(255, 255, 255, alpha * 0.08);
          ctx.lineWidth = 0.5;
        }
      }
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Draw stars/nodes
    for (let si = 0; si < c.stars.length; si++) {
      const s = c.stars[si];

      if (isOff) {
        const starAlpha = (s.traced || c.completed) ? alpha * 0.7 : alpha * 0.25;
        const starSize = (s.traced || c.completed) ? 2.5 : 1.5;

        if (c.completed) {
          const dissolve = 0.5 + 0.5 * Math.sin(c.sparklePhase + si * 1.3);
          const dissolveR = starSize + dissolve * 5;
          const dGrad = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, dissolveR);
          dGrad.addColorStop(0, 'rgba(0, 0, 0, ' + (alpha * dissolve * 0.3) + ')');
          dGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
          ctx.beginPath();
          ctx.arc(s.x, s.y, dissolveR, 0, Math.PI * 2);
          ctx.fillStyle = dGrad;
          ctx.fill();
        }

        ctx.beginPath();
        ctx.arc(s.x, s.y, starSize, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(0, 0, 0, ' + starAlpha + ')';
        ctx.fill();
      } else {
        const starAlpha = (s.traced || c.completed) ? alpha * 0.9 : alpha * 0.4;
        const starSize = (s.traced || c.completed) ? 2.5 : 1.8;

        if (c.completed) {
          const sparkle = 0.5 + 0.5 * Math.sin(c.sparklePhase + si * 1.3);
          ctx.beginPath();
          ctx.arc(s.x, s.y, starSize + sparkle * 4, 0, Math.PI * 2);
          ctx.fillStyle = rgba(200, 220, 255, alpha * sparkle * 0.3);
          ctx.fill();
        }

        ctx.beginPath();
        ctx.arc(s.x, s.y, starSize, 0, Math.PI * 2);
        ctx.fillStyle = rgba(255, 255, 255, starAlpha);
        ctx.fill();
      }
    }

    // Show name when completed
    if (c.completed) {
      const ccx = c.stars.reduce(function(sum, s) { return sum + s.x; }, 0) / c.stars.length;
      const ccy = c.stars.reduce(function(sum, s) { return sum + s.y; }, 0) / c.stars.length;
      ctx.save();
      ctx.font = '12px "Courier New", monospace';
      ctx.textAlign = 'center';
      if (isOff) {
        ctx.fillStyle = 'rgba(0, 0, 0, ' + (alpha * 0.5) + ')';
        ctx.fillText(c.name, ccx, ccy - 15);
        const textWidth = ctx.measureText(c.name).width;
        ctx.beginPath();
        ctx.moveTo(ccx - textWidth / 2, ccy - 12);
        ctx.lineTo(ccx + textWidth / 2, ccy - 12);
        ctx.strokeStyle = 'rgba(0, 0, 0, ' + (alpha * 0.3) + ')';
        ctx.lineWidth = 1;
        ctx.stroke();
      } else {
        ctx.fillStyle = rgba(200, 220, 255, alpha * 0.7);
        ctx.fillText(c.name, ccx, ccy - 15);
      }
      ctx.restore();
    }
  }

  // Draw current drag path
  if (constellationDragActive && constellationDragPath.length > 1) {
    ctx.beginPath();
    ctx.moveTo(constellationDragPath[0].x, constellationDragPath[0].y);
    for (let i = 1; i < constellationDragPath.length; i++) {
      ctx.lineTo(constellationDragPath[i].x, constellationDragPath[i].y);
    }
    if (isOff) {
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.25)';
    } else {
      ctx.strokeStyle = rgba(200, 220, 255, 0.3);
    }
    ctx.lineWidth = 1;
    ctx.stroke();
  }
}

export function startConstellationDrag(x, y, acIsPenaltyActive) {
  if (acIsPenaltyActive()) return;
  if (getUpgradeCount('constellation') === 0) return;
  for (const c of activeConstellations) {
    if (c.completed) continue;
    for (let si = 0; si < c.stars.length; si++) {
      const s = c.stars[si];
      const dx = x - s.x;
      const dy = y - s.y;
      if (Math.sqrt(dx * dx + dy * dy) < 25) {
        constellationDragActive = true;
        constellationDragPath = [{ x: x, y: y, starIdx: si, constellation: c }];
        s.traced = true;
        return;
      }
    }
  }
}

export function moveConstellationDrag(x, y, checkMilestones, updateUI) {
  if (!constellationDragActive || constellationDragPath.length === 0) return;
  constellationDragPath.push({ x: x, y: y });

  const firstPoint = constellationDragPath[0];
  const c = firstPoint.constellation;
  if (c.completed) { endConstellationDrag(); return; }

  for (let si = 0; si < c.stars.length; si++) {
    const s = c.stars[si];
    const dx = x - s.x;
    const dy = y - s.y;
    if (Math.sqrt(dx * dx + dy * dy) < 25) {
      s.traced = true;

      for (const edge of c.edges) {
        if (edge.traced) continue;
        const otherIdx = (edge.from === si) ? edge.to : ((edge.to === si) ? edge.from : -1);
        if (otherIdx >= 0 && c.stars[otherIdx].traced) {
          edge.traced = true;
        }
      }

      const allTraced = c.edges.every(function(e) { return e.traced; });
      if (allTraced) {
        c.completed = true;
        const constellationCount = getUpgradeCount('constellation');
        const bonus = Math.max(100, Math.floor(state.totalLumens * (0.01 + constellationCount * 0.005)));
        state.lumens += bonus;
        state.totalLumens += bonus;
        checkMilestones();
        updateUI();

        const cx = c.stars.reduce(function(sum, s) { return sum + s.x; }, 0) / c.stars.length;
        const cy = c.stars.reduce(function(sum, s) { return sum + s.y; }, 0) / c.stars.length;
        if (gameMode === 'off') {
          halos.push({
            type: 'void-implode',
            x: cx, y: cy,
            maxRadius: 90,
            opacity: 0.5,
            life: 1.0,
            decay: 0.01,
            delay: 0,
          });
        } else {
          halos.push({
            type: 'glow',
            x: cx, y: cy,
            maxRadius: 80,
            opacity: 0.6,
            life: 1.0,
            decay: 0.01,
            delay: 0,
          });
        }
      }
    }
  }
}

export function endConstellationDrag() {
  constellationDragActive = false;
  constellationDragPath = [];
}

export function resetConstellations() {
  activeConstellations.length = 0;
}
