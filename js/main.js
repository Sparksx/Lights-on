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
import { initMultiplayer, mp, onMultiplayerUpdate, notifySideChange } from './multiplayer.js';
import { setServerAvailable, isOnboardingDone, isMultiplayerActive, checkOnboarding } from './onboarding.js';

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
modeOn.addEventListener('click', function () { startGame('on'); notifySideChange('on'); });
modeOff.addEventListener('click', function () { startGame('off'); notifySideChange('off'); });

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

// =============================================
//  MULTIPLAYER — Progressive UI
// =============================================

// DOM refs for multiplayer UI
var mpBalance       = document.getElementById('mp-balance');
var mpBalanceCircle = document.getElementById('mp-balance-circle');
var mpOverlay       = document.getElementById('mp-overlay');
var mpOverlayClose  = document.getElementById('mp-overlay-close');
var mpOverlayBackdrop = document.getElementById('mp-overlay-backdrop');
var mpOverlayAvatar = document.getElementById('mp-overlay-avatar');
var mpOverlayName   = document.getElementById('mp-overlay-name');
var mpOverlayLogout = document.getElementById('mp-overlay-logout');
var mpOverlayLightBar   = document.getElementById('mp-overlay-light-bar');
var mpOverlayDarkBar    = document.getElementById('mp-overlay-dark-bar');
var mpOverlayLightTotal = document.getElementById('mp-overlay-light-total');
var mpOverlayDarkTotal  = document.getElementById('mp-overlay-dark-total');
var mpOverlayOnline     = document.getElementById('mp-overlay-online');

function formatShort(n) {
  if (n >= 1e12) return (n / 1e12).toFixed(1) + 'T';
  if (n >= 1e9) return (n / 1e9).toFixed(1) + 'B';
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
  return String(n);
}

// --- Update balance indicator circle proportions ---
function updateBalanceCircle(light, dark) {
  var total = light + dark;
  var lightPct = total > 0 ? (light / total) * 100 : 50;

  // For ON mode: white = light side, starts from top (270deg)
  // For OFF mode: colors swap via CSS, same logic
  mpBalanceCircle.style.background =
    'conic-gradient(from 270deg, #fff 0%, #fff ' + lightPct + '%, #000 ' + lightPct + '%, #000 100%)';

  // In OFF mode, the CSS override swaps the colors
  if (gameMode === 'off') {
    mpBalanceCircle.style.background =
      'conic-gradient(from 270deg, #000 0%, #000 ' + lightPct + '%, #fff ' + lightPct + '%, #fff 100%)';
  }
}

// --- Update the full overlay with current multiplayer state ---
function updateMultiplayerUI(mpState) {
  // Balance indicator: only show if onboarding is done and user connected
  if (isMultiplayerActive() && mpState.connected) {
    mpBalance.classList.remove('hidden');
    mpBalance.classList.add('online');
  }

  // Update balance proportions
  var light = mpState.cosmicWar.totalLight;
  var dark = mpState.cosmicWar.totalDark;
  updateBalanceCircle(light, dark);

  // Overlay user info
  if (mpState.user) {
    mpOverlayName.textContent = mpState.user.displayName;
    if (mpState.user.avatar) {
      mpOverlayAvatar.src = mpState.user.avatar;
      mpOverlayAvatar.style.display = '';
    } else {
      mpOverlayAvatar.style.display = 'none';
    }
    mpOverlayLogout.style.display = '';
  } else {
    mpOverlayName.textContent = '';
    mpOverlayAvatar.style.display = 'none';
    mpOverlayLogout.style.display = 'none';
  }

  // Overlay war gauge
  var total = light + dark;
  if (total > 0) {
    mpOverlayLightBar.style.width = ((light / total) * 100) + '%';
    mpOverlayDarkBar.style.width = ((dark / total) * 100) + '%';
  } else {
    mpOverlayLightBar.style.width = '50%';
    mpOverlayDarkBar.style.width = '50%';
  }
  mpOverlayLightTotal.textContent = formatShort(light);
  mpOverlayDarkTotal.textContent = formatShort(dark);
  mpOverlayOnline.textContent = mpState.online.total + ' en ligne';
}

onMultiplayerUpdate(updateMultiplayerUI);

// --- Balance indicator: open overlay on click ---
mpBalance.addEventListener('click', function (e) {
  e.stopPropagation();
  mpOverlay.classList.remove('hidden');
});

// --- Close overlay ---
function closeOverlay() {
  mpOverlay.classList.add('hidden');
}

mpOverlayClose.addEventListener('click', function (e) {
  e.stopPropagation();
  closeOverlay();
});

mpOverlayBackdrop.addEventListener('click', function (e) {
  e.stopPropagation();
  closeOverlay();
});

// --- Logout from overlay ---
mpOverlayLogout.addEventListener('click', function (e) {
  e.stopPropagation();
  fetch('/auth/logout', { method: 'POST' }).then(function () {
    mp.user = null;
    updateMultiplayerUI(mp);
  });
});

// --- Onboarding completion callback ---
window._onOnboardingDone = function (choice) {
  if (choice === 'connected') {
    // User chose to connect — OAuth redirect will handle the rest
  } else {
    // User chose solo — hide multiplayer permanently for this session
    mpBalance.classList.add('hidden');
  }
};

// --- Init multiplayer silently ---
(function initMP() {
  initMultiplayer().then(function () {
    setServerAvailable(true);

    // If user is already logged in (returned from OAuth), mark onboarding done
    if (mp.user) {
      try { localStorage.setItem('light-mp-onboarding', 'connected'); } catch (_) {}
    }

    // If onboarding was already completed with 'connected', show balance indicator
    if (isMultiplayerActive()) {
      mpBalance.classList.remove('hidden');
      if (mp.connected) mpBalance.classList.add('online');
      updateMultiplayerUI(mp);
    }

    // If onboarding hasn't been done yet and threshold met, it will trigger
    // from checkMilestones() during gameplay
    // Also check now in case we're loading a save above threshold
    checkOnboarding();
  }).catch(function () {
    // Server not available — multiplayer stays invisible
    setServerAvailable(false);
  });
})();
