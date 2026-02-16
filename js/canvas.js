// === Canvas — Canvas element, context, and resize ===
'use strict';

export const canvas = document.getElementById('halo-canvas');
export const ctx = canvas.getContext('2d');

export function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}

window.addEventListener('resize', resizeCanvas);
