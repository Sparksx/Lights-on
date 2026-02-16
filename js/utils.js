// === Utils — Protected refs, color helpers, formatting ===
'use strict';

import { gameMode } from './state.js';

// --- Protected native references (anti-tampering) ---
export var _raf = window.requestAnimationFrame.bind(window);
export var _si = window.setInterval.bind(window);
export var _st = window.setTimeout.bind(window);
export var _now = Date.now.bind(Date);

// --- Color helpers for mode-aware rendering ---
export function rgb(r, g, b) {
  if (gameMode === 'off') {
    return (255 - r) + ', ' + (255 - g) + ', ' + (255 - b);
  }
  return r + ', ' + g + ', ' + b;
}

export function rgba(r, g, b, a) {
  return 'rgba(' + rgb(r, g, b) + ', ' + a + ')';
}

// --- Format numbers ---
export function formatNumber(n) {
  if (n >= 1000000000000) return (n / 1000000000000).toFixed(1) + 'T';
  if (n >= 1000000000) return (n / 1000000000).toFixed(1) + 'B';
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
  return Math.floor(n).toString();
}

// Unit name based on mode
export function unitName() {
  return gameMode === 'off' ? 'ob' : 'lm';
}

// --- Easing ---
export function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}
