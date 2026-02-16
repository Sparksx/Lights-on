// === Interaction — Rubbing/swiping, combo, anti-auto-clicker ===
'use strict';

import { state, gameMode, getUpgradeCount, shared, getSaveKey, prestigeMultiplier } from './state.js';
import { _st, _now } from './utils.js';
import { canvas, ctx } from './canvas.js';
import { halos } from './effects/halos.js';

// --- Rubbing/swiping mechanic ---
let isRubbing = false;
let lastRubX = 0;
let lastRubY = 0;
let rubDistance = 0;
const RUB_THRESHOLD = 20;

export function startRub(x, y) {
  if (state.victoryReached || state.sunPurchased || shared.sunCinematicActive || acIsPenaltyActive()) return;
  isRubbing = true;
  lastRubX = x;
  lastRubY = y;
  rubDistance = 0;
}

export function moveRub(x, y, checkMilestones, updateUI) {
  if (!isRubbing || state.victoryReached || state.sunPurchased || shared.sunCinematicActive || acIsPenaltyActive()) return;
  if (getUpgradeCount('spark') === 0) return;
  const dx = x - lastRubX;
  const dy = y - lastRubY;
  const dist = Math.sqrt(dx * dx + dy * dy);
  rubDistance += dist;
  lastRubX = x;
  lastRubY = y;

  if (rubDistance >= RUB_THRESHOLD) {
    const rubPower = Math.max(1, Math.floor(state.clickPower * 0.3 * prestigeMultiplier));
    state.lumens += rubPower;
    state.totalLumens += rubPower;
    rubDistance -= RUB_THRESHOLD;

    if (gameMode === 'off') {
      halos.push({ type: 'void-stain', x: x + (Math.random() - 0.5) * 10, y: y + (Math.random() - 0.5) * 10, maxRadius: 10 + Math.random() * 15, opacity: 0.25 + Math.random() * 0.2, life: 1.0, decay: 0.04, delay: 0 });
    } else {
      halos.push({ type: 'glow', x, y, maxRadius: 8 + Math.random() * 12, opacity: 0.3 + Math.random() * 0.3, life: 1.0, decay: 0.06, delay: 0 });
    }

    checkMilestones();
    updateUI();
  }
}

export function endRub() {
  isRubbing = false;
  rubDistance = 0;
}

// --- Combo system ---
export let comboCount = 0;
export let comboTimer = null;
export const COMBO_WINDOW = 800;
export const COMBO_DECAY = 2000;

export function incrementCombo() { comboCount++; }
export function resetCombo() { comboCount = 0; }
export function setComboTimer(t) { comboTimer = t; }

export function getComboMultiplier() {
  if (comboCount < 3) return 1;
  if (comboCount < 8) return 1.5;
  if (comboCount < 15) return 2;
  if (comboCount < 25) return 3;
  return 5;
}

export function showComboGlow(x, y, multiplier) {
  const glowSize = 30 + multiplier * 20;
  const warmth = Math.min(multiplier / 5, 1);

  if (gameMode === 'off') {
    halos.push({ type: 'cold-glow', x, y, maxRadius: glowSize, opacity: 0.35 + multiplier * 0.12, life: 1.0, decay: 0.015, delay: 0, warmth: warmth });
    halos.push({ type: 'cold-ring', x, y, maxRadius: glowSize * 2.5, opacity: 0.25 + multiplier * 0.1, life: 1.0, decay: 0.02, delay: 0, warmth: warmth });
  } else {
    halos.push({ type: 'combo-glow', x, y, maxRadius: glowSize, opacity: 0.3 + multiplier * 0.1, life: 1.0, decay: 0.015, delay: 0, warmth: warmth });
    halos.push({ type: 'combo-ring', x, y, maxRadius: glowSize * 2, opacity: 0.2 + multiplier * 0.08, life: 1.0, decay: 0.02, delay: 0, warmth: warmth });
  }
}

// --- Anti Auto-Clicker Detection ---
var AC_BUFFER_SIZE = 40;
var AC_MIN_AVG_INTERVAL = 35;
var AC_REGULARITY_THRESHOLD = 12;
var AC_SAME_POS_RADIUS = 3;
var AC_PENALTY_DURATION = 7000;
var AC_DETECTION_MIN_CLICKS = 12;
var AC_BURST_WINDOW = 1000;
var AC_BURST_THRESHOLD = 22;

var acClickTimes = [];
var acClickPositions = [];
var acPenaltyActive = false;
var acPenaltyStart = 0;
var acExplosionParticles = [];
var acWarningOpacity = 0;
var AC_MAX_STRIKES = 4;
var acResetScheduled = false;

export function acRecordClick(x, y) {
  acClickTimes.push(_now());
  acClickPositions.push({ x: x, y: y });
  if (acClickTimes.length > AC_BUFFER_SIZE) {
    acClickTimes.shift();
    acClickPositions.shift();
  }
}

export function acDetect() {
  if (acClickTimes.length < AC_DETECTION_MIN_CLICKS) return false;

  var now = _now();
  var burstCount = 0;
  for (var b = acClickTimes.length - 1; b >= 0; b--) {
    if (now - acClickTimes[b] <= AC_BURST_WINDOW) burstCount++;
    else break;
  }
  if (burstCount >= AC_BURST_THRESHOLD) return true;

  var intervals = [];
  for (var i = 1; i < acClickTimes.length; i++) {
    intervals.push(acClickTimes[i] - acClickTimes[i - 1]);
  }

  var sum = 0;
  for (var j = 0; j < intervals.length; j++) sum += intervals[j];
  var avg = sum / intervals.length;

  var variance = 0;
  for (var k = 0; k < intervals.length; k++) {
    var diff = intervals[k] - avg;
    variance += diff * diff;
  }
  var stdDev = Math.sqrt(variance / intervals.length);

  var sameCount = 0;
  var lastPos = acClickPositions[acClickPositions.length - 1];
  for (var m = 0; m < acClickPositions.length - 1; m++) {
    var dx = acClickPositions[m].x - lastPos.x;
    var dy = acClickPositions[m].y - lastPos.y;
    if (Math.sqrt(dx * dx + dy * dy) < AC_SAME_POS_RADIUS) sameCount++;
  }
  var samePosRatio = sameCount / (acClickPositions.length - 1);

  var score = 0;
  if (avg < AC_MIN_AVG_INTERVAL) score += 2;
  if (stdDev < AC_REGULARITY_THRESHOLD && avg < 100) score += 2;
  if (samePosRatio > 0.85 && avg < 100) score += 1;

  return score >= 2;
}

export function acTriggerPenalty(save) {
  acPenaltyActive = true;
  shared.acPenaltyCount++;
  acClickTimes = [];
  acClickPositions = [];
  comboCount = 0;

  var isFinal = shared.acPenaltyCount >= AC_MAX_STRIKES;
  acResetScheduled = isFinal;

  var duration = isFinal ? 12000 : AC_PENALTY_DURATION + (shared.acPenaltyCount - 1) * 3000;
  acPenaltyStart = _now();
  acWarningOpacity = 1.0;
  acExplosionParticles = [];

  var cx = canvas.width / 2;
  var cy = canvas.height / 2;

  var particleCount = isFinal ? 500 : 250;
  var speedMult = isFinal ? 1.8 : 1;
  var sizeMult = isFinal ? 1.5 : 1;

  for (var i = 0; i < particleCount; i++) {
    var angle = (Math.PI * 2 * i) / particleCount + (Math.random() - 0.5) * 0.4;
    var speed = (1.5 + Math.random() * 10) * speedMult;
    var size = (3 + Math.random() * 14) * sizeMult;
    acExplosionParticles.push({ x: cx, y: cy, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, size: size, life: 1.0, decay: isFinal ? 0.001 + Math.random() * 0.003 : 0.002 + Math.random() * 0.004, rotation: Math.random() * Math.PI * 2, rotSpeed: (Math.random() - 0.5) * 0.2, hue: isFinal ? Math.random() * 360 : Math.random() * 60, trail: [] });
  }

  var debrisCount = isFinal ? 80 : 30;
  for (var d = 0; d < debrisCount; d++) {
    var dAngle = Math.random() * Math.PI * 2;
    var dSpeed = (3 + Math.random() * 6) * speedMult;
    acExplosionParticles.push({ type: 'debris', x: cx + (Math.random() - 0.5) * 40, y: cy + (Math.random() - 0.5) * 40, vx: Math.cos(dAngle) * dSpeed, vy: Math.sin(dAngle) * dSpeed + Math.random() * 2, size: (6 + Math.random() * 10) * sizeMult, life: 1.0, decay: isFinal ? 0.002 + Math.random() * 0.002 : 0.004 + Math.random() * 0.003, rotation: Math.random() * Math.PI * 2, rotSpeed: (Math.random() - 0.5) * 0.3 });
  }

  var ringCount = isFinal ? 10 : 6;
  for (var r = 0; r < ringCount; r++) {
    acExplosionParticles.push({ type: 'shockwave', x: cx, y: cy, radius: 0, maxRadius: Math.max(canvas.width, canvas.height) * (isFinal ? 1.2 : 0.8), speed: (4 + r * 2.5) * (isFinal ? 1.3 : 1), life: 1.0, decay: isFinal ? 0.004 : 0.007, delay: r * (isFinal ? 4 : 6) });
  }

  if (isFinal) {
    for (var w = 0; w < 60; w++) {
      var wAngle = Math.random() * Math.PI * 2;
      var wDist = 300 + Math.random() * 400;
      acExplosionParticles.push({ type: 'implode', x: cx + Math.cos(wAngle) * wDist, y: cy + Math.sin(wAngle) * wDist, targetX: cx, targetY: cy, size: 4 + Math.random() * 8, life: 1.0, decay: 0.005, delay: 60 + Math.floor(Math.random() * 40), hue: Math.random() * 360 });
    }
  }

  acPenaltyActive = duration;

  if (isFinal) { save(); }
}

function acGetPenaltyDuration() {
  return typeof acPenaltyActive === 'number' ? acPenaltyActive : AC_PENALTY_DURATION;
}

export function acIsPenaltyActive() {
  if (acPenaltyActive === false) return false;
  var elapsed = _now() - acPenaltyStart;
  var duration = acGetPenaltyDuration();
  if (elapsed >= duration) {
    acPenaltyActive = false;
    acExplosionParticles = [];
    acWarningOpacity = 0;
    if (acResetScheduled) {
      acResetScheduled = false;
      try { localStorage.removeItem(getSaveKey()); } catch (_) {}
      try { localStorage.removeItem('light-game-mode'); } catch (_) {}
      window.location.reload();
      return true;
    }
    return false;
  }
  return true;
}

export function updateAcExplosion() {
  if (!acIsPenaltyActive()) return;
  var elapsed = _now() - acPenaltyStart;
  for (var i = acExplosionParticles.length - 1; i >= 0; i--) {
    var p = acExplosionParticles[i];
    if (p.type === 'shockwave') {
      if (p.delay > 0) { p.delay--; continue; }
      p.radius += p.speed;
      p.life -= p.decay;
    } else if (p.type === 'implode') {
      if (p.delay > 0) { p.delay--; continue; }
      var idx = p.targetX - p.x;
      var idy = p.targetY - p.y;
      var idist = Math.sqrt(idx * idx + idy * idy);
      if (idist > 2) {
        p.x += (idx / idist) * (3 + (1 - p.life) * 12);
        p.y += (idy / idist) * (3 + (1 - p.life) * 12);
      }
      p.life -= p.decay;
    } else if (p.type === 'debris') {
      p.x += p.vx; p.y += p.vy;
      p.vy += 0.05; p.vx *= 0.995;
      p.rotation += p.rotSpeed; p.life -= p.decay;
    } else {
      p.x += p.vx; p.y += p.vy;
      p.vx *= 0.992; p.vy *= 0.992;
      p.rotation += p.rotSpeed; p.life -= p.decay;
      if (p.life > 0.2 && p.trail.length < 12) { p.trail.push({ x: p.x, y: p.y, alpha: p.life * 0.3 }); }
      if (p.trail.length > 12) p.trail.shift();
    }
    if (p.life <= 0) { acExplosionParticles.splice(i, 1); }
  }
  var duration = acGetPenaltyDuration();
  if (elapsed > duration * 0.65) {
    acWarningOpacity = Math.max(0, 1 - (elapsed - duration * 0.65) / (duration * 0.35));
  }
}

export function drawAcExplosion() {
  if (!acIsPenaltyActive()) return;
  var elapsed = _now() - acPenaltyStart;
  var cx = canvas.width / 2;
  var cy = canvas.height / 2;

  var shakeIntensity = Math.max(0, 1 - elapsed / 2500) * 18;
  if (shakeIntensity > 0.5) {
    ctx.save();
    ctx.translate((Math.random() - 0.5) * shakeIntensity, (Math.random() - 0.5) * shakeIntensity);
  }

  var isFinalDraw = acResetScheduled;
  if (isFinalDraw) {
    var flashAlpha = Math.max(0, 1.0 - elapsed / 2000);
    var secondPulse = elapsed > 2000 ? Math.max(0, 0.7 - (elapsed - 2000) / 1500) : 0;
    var totalFlash = Math.min(1, flashAlpha + secondPulse);
    if (totalFlash > 0) {
      ctx.fillStyle = gameMode === 'off' ? 'rgba(30, 0, 50, ' + totalFlash + ')' : 'rgba(255, 100, 30, ' + totalFlash + ')';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    var duration = acGetPenaltyDuration();
    if (elapsed > duration * 0.75) {
      var fadeProgress = (elapsed - duration * 0.75) / (duration * 0.25);
      var fadeAlpha = Math.min(1, fadeProgress);
      ctx.fillStyle = gameMode === 'off' ? 'rgba(0, 0, 0, ' + fadeAlpha + ')' : 'rgba(255, 255, 255, ' + fadeAlpha + ')';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
  } else {
    var flashAlpha2 = Math.max(0, 0.9 - elapsed / 1200);
    if (flashAlpha2 > 0) {
      ctx.fillStyle = gameMode === 'off' ? 'rgba(0, 0, 0, ' + flashAlpha2 + ')' : 'rgba(255, 180, 60, ' + flashAlpha2 + ')';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
  }

  for (var s = 0; s < acExplosionParticles.length; s++) {
    var sw = acExplosionParticles[s];
    if (sw.type !== 'shockwave') continue;
    if (sw.delay > 0) continue;
    var swAlpha = sw.life * 0.5;
    ctx.beginPath();
    ctx.arc(sw.x, sw.y, sw.radius, 0, Math.PI * 2);
    ctx.strokeStyle = gameMode === 'off' ? 'rgba(60, 0, 90, ' + swAlpha + ')' : 'rgba(255, ' + Math.floor(120 + (sw.radius % 80)) + ', 30, ' + swAlpha + ')';
    ctx.lineWidth = 2 + sw.life * 6;
    ctx.stroke();
  }

  for (var j = 0; j < acExplosionParticles.length; j++) {
    var p = acExplosionParticles[j];
    if (p.type === 'shockwave') continue;
    if (p.type === 'implode' && p.delay > 0) continue;
    if (p.type === 'implode') {
      var iAlpha = Math.max(0, p.life) * 0.8;
      var iGrad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size * 2);
      if (gameMode === 'off') { iGrad.addColorStop(0, 'rgba(120, 0, 200, ' + iAlpha + ')'); iGrad.addColorStop(1, 'rgba(60, 0, 100, 0)'); }
      else { iGrad.addColorStop(0, 'rgba(255, 255, 220, ' + iAlpha + ')'); iGrad.addColorStop(1, 'rgba(255, 100, 0, 0)'); }
      ctx.fillStyle = iGrad;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill();
      continue;
    }
    var alpha = Math.max(0, p.life);
    if (p.trail) {
      for (var t = 0; t < p.trail.length; t++) {
        var tr = p.trail[t];
        var trAlpha = tr.alpha * (t / p.trail.length) * 0.4;
        if (trAlpha < 0.01) continue;
        ctx.beginPath(); ctx.arc(tr.x, tr.y, p.size * 0.4, 0, Math.PI * 2);
        ctx.fillStyle = gameMode === 'off' ? 'rgba(40, 0, 60, ' + trAlpha + ')' : 'rgba(255, ' + Math.floor(80 + p.hue * 2) + ', 30, ' + trAlpha + ')';
        ctx.fill();
      }
    }
    ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rotation);
    if (p.type === 'debris') {
      ctx.fillStyle = gameMode === 'off' ? 'rgba(20, 0, 40, ' + alpha + ')' : 'rgba(255, ' + Math.floor(150 + Math.random() * 100) + ', 50, ' + alpha + ')';
      ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
    } else {
      var grad = ctx.createRadialGradient(0, 0, 0, 0, 0, p.size);
      if (gameMode === 'off') { grad.addColorStop(0, 'rgba(100, 0, 150, ' + alpha + ')'); grad.addColorStop(0.5, 'rgba(50, 0, 90, ' + (alpha * 0.5) + ')'); grad.addColorStop(1, 'rgba(0, 0, 0, 0)'); }
      else { grad.addColorStop(0, 'rgba(255, 255, 200, ' + alpha + ')'); grad.addColorStop(0.5, 'rgba(255, 140, 40, ' + (alpha * 0.6) + ')'); grad.addColorStop(1, 'rgba(255, 50, 0, 0)'); }
      ctx.fillStyle = grad; ctx.beginPath(); ctx.arc(0, 0, p.size, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }

  var vignetteAlpha = acWarningOpacity * 0.35 * (0.7 + Math.sin(elapsed * 0.004) * 0.3);
  if (vignetteAlpha > 0.01) {
    var vGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(canvas.width, canvas.height) * 0.7);
    vGrad.addColorStop(0, 'rgba(0, 0, 0, 0)');
    vGrad.addColorStop(1, gameMode === 'off' ? 'rgba(60, 0, 100, ' + vignetteAlpha + ')' : 'rgba(180, 40, 0, ' + vignetteAlpha + ')');
    ctx.fillStyle = vGrad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  if (acWarningOpacity > 0.01) {
    var textAlpha = acWarningOpacity;
    var isFinalStrike = acResetScheduled;
    var pulse = isFinalStrike ? 0.8 + Math.sin(elapsed * 0.01) * 0.2 : 0.85 + Math.sin(elapsed * 0.006) * 0.15;
    var baseFontSize = Math.min(Math.max(canvas.width * 0.045, 22), 56);
    var fontSize = Math.floor(baseFontSize * pulse);
    ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    if (isFinalStrike) {
      var finalFontSize = Math.floor(fontSize * 1.3);
      ctx.font = 'bold ' + finalFontSize + 'px "Courier New", Courier, monospace';
      if (gameMode === 'off') { ctx.shadowColor = 'rgba(150, 0, 200, ' + textAlpha + ')'; ctx.fillStyle = 'rgba(80, 0, 120, ' + textAlpha + ')'; }
      else { ctx.shadowColor = 'rgba(255, 0, 0, ' + textAlpha + ')'; ctx.fillStyle = 'rgba(255, 60, 30, ' + textAlpha + ')'; }
      ctx.shadowBlur = 35;
      ctx.fillText(gameMode === 'off' ? 'VOID COLLAPSE' : 'STELLAR IMPLOSION', cx, cy - finalFontSize * 1.1);
      var subSize = Math.floor(finalFontSize * 0.38);
      ctx.font = 'bold ' + subSize + 'px "Courier New", Courier, monospace';
      ctx.shadowBlur = 15;
      ctx.fillText(gameMode === 'off' ? 'The void consumes itself... everything vanishes.' : 'The light burns out... everything fades.', cx, cy + finalFontSize * 0.15);
      if (elapsed > 3000) {
        var remaining = Math.ceil((acGetPenaltyDuration() - elapsed) / 1000);
        if (remaining > 0) {
          var countSize = Math.floor(finalFontSize * 0.7);
          ctx.font = 'bold ' + countSize + 'px "Courier New", Courier, monospace';
          ctx.shadowBlur = 20;
          if (gameMode === 'off') ctx.fillStyle = 'rgba(120, 0, 180, ' + (textAlpha * 0.9) + ')';
          else ctx.fillStyle = 'rgba(255, 100, 50, ' + (textAlpha * 0.9) + ')';
          ctx.fillText(remaining, cx, cy + finalFontSize * 0.15 + subSize * 2.2);
        }
      }
    } else {
      ctx.font = 'bold ' + fontSize + 'px "Courier New", Courier, monospace';
      ctx.shadowColor = gameMode === 'off' ? 'rgba(100, 0, 160, ' + textAlpha + ')' : 'rgba(255, 80, 0, ' + textAlpha + ')';
      ctx.shadowBlur = 25;
      ctx.fillStyle = gameMode === 'off' ? 'rgba(0, 0, 0, ' + textAlpha + ')' : 'rgba(255, 220, 120, ' + textAlpha + ')';
      ctx.fillText(gameMode === 'off' ? 'DARK OVERLOAD' : 'LIGHT OVERLOAD', cx, cy - fontSize * 0.9);
      var subSize2 = Math.floor(fontSize * 0.45);
      ctx.font = subSize2 + 'px "Courier New", Courier, monospace';
      ctx.shadowBlur = 12;
      ctx.fillText(gameMode === 'off' ? 'Imbalance detected in the void' : 'Imbalance detected in the light', cx, cy + fontSize * 0.3);
      if (shared.acPenaltyCount > 1) {
        ctx.font = Math.floor(subSize2 * 0.8) + 'px "Courier New", Courier, monospace';
        var levelMsg;
        if (shared.acPenaltyCount === 2) {
          levelMsg = gameMode === 'off' ? 'The void trembles' : 'The fabric of light fractures';
        } else {
          levelMsg = gameMode === 'off' ? 'Critical state \u2014 the void yields' : 'Critical state \u2014 the light falters';
        }
        ctx.fillText(levelMsg, cx, cy + fontSize * 0.3 + subSize2 * 1.4);
      }
    }
    ctx.restore();
  }

  if (shakeIntensity > 0.5) { ctx.restore(); }
}
