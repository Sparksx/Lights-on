// === Intro — New game intro overlay ===
'use strict';

import { gameMode } from './state.js';
import { _st } from './utils.js';
import { introOverlay, introText, introPlea } from './dom.js';

export function showIntro(onDone) {
  introOverlay.classList.remove('hidden');

  if (gameMode === 'off') {
    introText.textContent = 'The darkness is fading\u2026';
    introPlea.textContent = 'Save me\u2026';
  } else {
    introText.textContent = 'The light is dying\u2026';
    introPlea.textContent = 'Save me\u2026';
  }

  let dismissed = false;
  function dismissIntro() {
    if (dismissed) return;
    dismissed = true;
    introOverlay.removeEventListener('click', dismissIntro);
    introOverlay.classList.add('fade-out');
    _st(function () {
      introOverlay.classList.add('hidden');
      introOverlay.classList.remove('fade-out');
      onDone();
    }, 800);
  }

  introOverlay.addEventListener('click', dismissIntro);
  _st(dismissIntro, 5000);
}
