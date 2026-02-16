// === Main — Entry point, mode selection, init ===
'use strict';

import { state, gameMode, gameStarted, setGameMode, setGameStarted, getSaveKey, prestigeLevel, prestigeMultiplier } from './state.js';
import { _st, _si, _now, formatNumber, unitName } from './utils.js';
import { modeSelect, modeOn, modeOff, gameArea, upgradeToggle, upgradePanel, victoryScreen, prestigeInfo } from './dom.js';
import { resizeCanvas } from './canvas.js';
import { save, load } from './save.js';
import { recalcPassive, checkMilestones, renderUpgrades, setupUpgradeListeners } from './upgrades.js';
import { updateUI } from './ui.js';
import { gameLoop, passiveTick } from './game-loop.js';
import { showIntro } from './intro.js';
import { setupInputListeners } from './click.js';
import { showSwitch, setupVictoryListeners } from './victory.js';
import { regenerateStars } from './effects/stars.js';

function startGame(mode) {
  if (gameStarted) return;
  setGameStarted(true);
  setGameMode(mode);

  // Animate the chosen side taking over
  const chosenEl = mode === 'on' ? modeOn : modeOff;
  chosenEl.classList.add('chosen');
  modeSelect.classList.add('choosing');

  if (mode === 'off') {
    document.body.classList.add('mode-off');
  }

  // Update victory text based on mode
  const victoryTitle = document.getElementById('victory-title');
  const victoryText = document.getElementById('victory-text');
  const switchHint = document.getElementById('switch-hint');
  if (mode === 'off') {
    victoryTitle.textContent = 'LIGHTS OFF';
    victoryText.textContent = 'You turned off the light.';
    switchHint.textContent = 'Turn off the light';
  } else {
    victoryTitle.textContent = 'LIGHTS ON';
    victoryText.textContent = 'You brought back the light.';
    switchHint.textContent = 'Turn on the light';
  }

  // Save chosen mode
  try { localStorage.setItem('light-game-mode', mode); } catch (_) {}

  // After animation, reveal the game
  _st(function () {
    modeSelect.style.display = 'none';
    gameArea.classList.remove('hidden');
    resizeCanvas();
    initGame();
  }, 700);
}

function initGame() {
  const isNewGame = !localStorage.getItem(getSaveKey());

  // Load saved state
  const data = load();

  if (data) {
    // Post-load initialization
    recalcPassive();
    checkMilestones();
    regenerateStars();
    updateUI();
    renderUpgrades();

    // --- Offline earnings ---
    var savedTime = data.lastSaveTime || 0;
    if (savedTime > 0 && state.lumensPerSecond > 0 && !state.victoryReached) {
      var elapsed = (_now() - savedTime) / 1000;
      var maxOffline = 3600;
      elapsed = Math.min(elapsed, maxOffline);
      if (elapsed > 10) {
        var offlineGain = Math.floor(state.lumensPerSecond * elapsed * 0.5 * prestigeMultiplier);
        if (offlineGain > 0) {
          state.lumens += offlineGain;
          state.totalLumens += offlineGain;
          updateUI();
          var offlinePopup = document.getElementById('offline-popup');
          var offlineText = document.getElementById('offline-text');
          offlineText.textContent = 'While you were away...\n+' + formatNumber(offlineGain) + ' ' + unitName();
          offlinePopup.classList.remove('hidden');
          offlinePopup.addEventListener('click', function dismissOffline() {
            offlinePopup.classList.add('fade-out');
            _st(function () { offlinePopup.classList.add('hidden'); offlinePopup.classList.remove('fade-out'); }, 600);
            offlinePopup.removeEventListener('click', dismissOffline);
          });
          _st(function () {
            offlinePopup.classList.add('fade-out');
            _st(function () { offlinePopup.classList.add('hidden'); offlinePopup.classList.remove('fade-out'); }, 600);
          }, 4000);
        }
      }
    }

    // Restore victory / switch state
    if (state.victoryReached) {
      var nextMult = 1 + (prestigeLevel + 1) * 0.5;
      prestigeInfo.textContent = 'Cross over. x' + nextMult.toFixed(1) + ' power awaits.';
      victoryScreen.classList.remove('hidden');
    } else if (state.sunPurchased) {
      upgradeToggle.classList.add('hidden');
      showSwitch();
    }
  }

  // Setup event listeners
  setupInputListeners();
  setupUpgradeListeners();
  setupVictoryListeners();

  updateUI();
  gameLoop();
  _si(passiveTick, 100);
  _si(save, 5000); // auto-save every 5s
  _si(function () {
    if (upgradePanel.classList.contains('open')) {
      renderUpgrades();
    }
  }, 500);

  if (isNewGame) {
    showIntro(function () {
      // Intro done — game is already running underneath
    });
  }
}

// --- Mode selection ---
modeOn.addEventListener('click', function () { startGame('on'); });
modeOff.addEventListener('click', function () { startGame('off'); });

// Check for saved game — skip landing if save exists
(function checkSavedGame() {
  try {
    var savedMode = localStorage.getItem('light-game-mode');
    var hasOnSave = localStorage.getItem('lights-on-save');
    var hasOffSave = localStorage.getItem('lights-off-save');
    if (savedMode === 'off' && hasOffSave) {
      startGame('off');
    } else if (savedMode === 'on' && hasOnSave) {
      startGame('on');
    } else if (!savedMode && hasOnSave) {
      startGame('on');
    }
  } catch (_) {}
})();
