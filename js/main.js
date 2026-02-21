// === Main — Entry point, mode selection, init ===
'use strict';

import {
  state,
  gameMode,
  gameStarted,
  setGameMode,
  setGameStarted,
  getSaveKey,
  prestigeLevel,
  prestigeMultiplier,
  getTotalPrestigeMultiplier,
  setMpPrestigeBonus,
} from './state.js';
import { _st, _si, _now, formatNumber, unitName } from './utils.js';
import {
  modeSelect,
  modeOn,
  modeOff,
  gameArea,
  upgradeToggle,
  upgradePanel,
  victoryScreen,
  prestigeInfo,
} from './dom.js';
import { resizeCanvas } from './canvas.js';
import { save, load } from './save.js';
import { recalcPassive, checkMilestones, renderUpgrades, setupUpgradeListeners } from './upgrades.js';
import { updateUI } from './ui.js';
import { gameLoop, passiveTick } from './game-loop.js';
import { showIntro } from './intro.js';
import { setupInputListeners } from './click.js';
import { showSwitch, setupVictoryListeners } from './victory.js';
import { regenerateStars } from './effects/stars.js';
import {
  initMultiplayer,
  mp,
  onMultiplayerUpdate,
  onSeasonEnd,
  onRewardReceived,
  onStreakChange,
  notifySideChange,
  setContributionRate,
  reportLumens,
} from './multiplayer.js';
import { setServerAvailable, isOnboardingDone, isMultiplayerActive, checkOnboarding } from './onboarding.js';
import { showSeasonEnd, showSeasonEndBroadcast } from './season-end.js';

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
  try {
    localStorage.setItem('light-game-mode', mode);
  } catch (_) {}

  // After animation, reveal the game
  _st(function () {
    modeSelect.style.display = 'none';
    gameArea.classList.remove('hidden');
    resizeCanvas();
    initGame();
    // Notify server of side choice after game is initialized
    notifySideChange(mode);
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
        var offlineGain = Math.floor(state.lumensPerSecond * elapsed * 0.5 * getTotalPrestigeMultiplier());
        if (offlineGain > 0) {
          state.lumens += offlineGain;
          state.totalLumens += offlineGain;
          reportLumens(offlineGain);
          updateUI();
          var offlinePopup = document.getElementById('offline-popup');
          var offlineText = document.getElementById('offline-text');
          offlineText.textContent = 'While you were away...\n+' + formatNumber(offlineGain) + ' ' + unitName();
          offlinePopup.classList.remove('hidden');
          offlinePopup.addEventListener('click', function dismissOffline() {
            offlinePopup.classList.add('fade-out');
            _st(function () {
              offlinePopup.classList.add('hidden');
              offlinePopup.classList.remove('fade-out');
            }, 600);
            offlinePopup.removeEventListener('click', dismissOffline);
          });
          _st(function () {
            offlinePopup.classList.add('fade-out');
            _st(function () {
              offlinePopup.classList.add('hidden');
              offlinePopup.classList.remove('fade-out');
            }, 600);
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
modeOn.addEventListener('click', function () {
  startGame('on');
});
modeOff.addEventListener('click', function () {
  startGame('off');
});

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
var mpBalance = document.getElementById('mp-balance');
var mpBalanceCircle = document.getElementById('mp-balance-circle');
var mpOverlay = document.getElementById('mp-overlay');
var mpOverlayClose = document.getElementById('mp-overlay-close');
var mpOverlayBackdrop = document.getElementById('mp-overlay-backdrop');
var mpOverlayAvatar = document.getElementById('mp-overlay-avatar');
var mpOverlayName = document.getElementById('mp-overlay-name');
var mpOverlayGrade = document.getElementById('mp-overlay-grade');
var mpOverlayLogout = document.getElementById('mp-overlay-logout');
var mpOverlayLightBar = document.getElementById('mp-overlay-light-bar');
var mpOverlayDarkBar = document.getElementById('mp-overlay-dark-bar');
var mpOverlayLightTotal = document.getElementById('mp-overlay-light-total');
var mpOverlayDarkTotal = document.getElementById('mp-overlay-dark-total');
var mpOverlayOnline = document.getElementById('mp-overlay-online');
var mpOverlaySeasonNum = document.getElementById('mp-overlay-season-num');
var mpOverlaySeasonTimer = document.getElementById('mp-overlay-season-timer');
var mpOverlaySeason = document.getElementById('mp-overlay-season');
var mpOverlayPlayer = document.getElementById('mp-overlay-player');
var mpOverlayPlayerContrib = document.getElementById('mp-overlay-player-contrib');
var mpOverlayPlayerStreak = document.getElementById('mp-overlay-player-streak');
var mpOverlayPlayerPrestige = document.getElementById('mp-overlay-player-prestige');
var mpOverlayRateBtns = document.querySelectorAll('.mp-rate-btn');
var mpOverlayLeaderboardBtn = document.getElementById('mp-overlay-leaderboard-btn');
var mpBalanceGrade = document.getElementById('mp-balance-grade');
var mpOverlayLogin = document.getElementById('mp-overlay-login');

// Leaderboard DOM
var mpLeaderboard = document.getElementById('mp-leaderboard');
var mpLeaderboardBackdrop = document.getElementById('mp-leaderboard-backdrop');
var mpLeaderboardClose = document.getElementById('mp-leaderboard-close');
var mpLeaderboardTitle = document.getElementById('mp-leaderboard-title');
var mpLeaderboardTabs = document.querySelectorAll('.mp-lb-tab');
var mpLeaderboardList = document.getElementById('mp-leaderboard-list');
var mpLeaderboardPlayerRank = document.getElementById('mp-leaderboard-player-rank');

// --- Update balance indicator circle proportions ---
function updateBalanceCircle(light, dark) {
  var total = light + dark;
  var lightPct = total > 0 ? (light / total) * 100 : 50;

  mpBalanceCircle.style.background =
    'conic-gradient(from 270deg, #fff 0%, #fff ' + lightPct + '%, #000 ' + lightPct + '%, #000 100%)';

  if (gameMode === 'off') {
    mpBalanceCircle.style.background =
      'conic-gradient(from 270deg, #000 0%, #000 ' + lightPct + '%, #fff ' + lightPct + '%, #fff 100%)';
  }
}

// --- Update the full overlay with current multiplayer state ---
function updateMultiplayerUI(mpState) {
  // Balance indicator: only show if onboarding is done
  if (isMultiplayerActive()) {
    mpBalance.classList.remove('hidden');
    if (mpState.connected) {
      mpBalance.classList.add('online');
      mpBalance.classList.remove('disconnected');
    } else {
      mpBalance.classList.remove('online');
      mpBalance.classList.add('disconnected');
    }
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
    mpOverlayLogin.classList.add('hidden');
  } else {
    mpOverlayName.textContent = '';
    mpOverlayAvatar.style.display = 'none';
    mpOverlayLogout.style.display = 'none';
    mpOverlayLogin.classList.remove('hidden');
  }

  // Grade badge
  if (mpState.profile && mpState.profile.grade && mpState.profile.grade !== 'none') {
    mpOverlayGrade.textContent = mpState.profile.grade;
    mpOverlayGrade.style.display = '';
  } else {
    mpOverlayGrade.style.display = 'none';
  }

  // Overlay war gauge
  var total = light + dark;
  if (total > 0) {
    mpOverlayLightBar.style.width = (light / total) * 100 + '%';
    mpOverlayDarkBar.style.width = (dark / total) * 100 + '%';
  } else {
    mpOverlayLightBar.style.width = '50%';
    mpOverlayDarkBar.style.width = '50%';
  }
  mpOverlayLightTotal.textContent = formatNumber(light);
  mpOverlayDarkTotal.textContent = formatNumber(dark);
  mpOverlayOnline.textContent = mpState.online.total + ' en ligne';

  // Season info
  if (mpState.seasonInfo.season > 0) {
    mpOverlaySeasonNum.textContent = 'Saison ' + mpState.seasonInfo.season;
    if (mpState.seasonInfo.isLastDay) {
      mpOverlaySeasonTimer.textContent = 'Dernières heures !';
      mpOverlaySeason.classList.add('last-day');
    } else if (mpState.seasonInfo.remainingDays > 0) {
      mpOverlaySeasonTimer.textContent = mpState.seasonInfo.remainingDays + 'j restants';
      mpOverlaySeason.classList.remove('last-day');
    } else {
      mpOverlaySeasonTimer.textContent = '';
      mpOverlaySeason.classList.remove('last-day');
    }
  }

  // Player contribution section
  if (mpState.user && mpState.profile) {
    mpOverlayPlayer.classList.remove('hidden');
    mpOverlayPlayerContrib.textContent =
      formatNumber(mpState.profile.contribution) + (gameMode === 'off' ? ' ob' : ' lm');

    if (mpState.profile.streakDays > 0) {
      var streakText = mpState.profile.streakDays + 'j consécutifs';
      if (mpState.profile.streakMultiplier > 1) {
        streakText += ' (x' + mpState.profile.streakMultiplier.toFixed(1) + ')';
      }
      mpOverlayPlayerStreak.textContent = streakText;
    } else {
      mpOverlayPlayerStreak.textContent = '';
    }

    // Prestige bonus display
    if (mpState.profile.mpPrestigeBonus > 0) {
      mpOverlayPlayerPrestige.textContent =
        'Bonus prestige : +' + mpState.profile.mpPrestigeBonus.toFixed(2) + ' (saisons passées)';
      mpOverlayPlayerPrestige.classList.remove('hidden');
    } else {
      mpOverlayPlayerPrestige.classList.add('hidden');
    }

    // Update rate buttons
    updateRateButtons(mpState.contributionRate);

    // Update local mp prestige bonus
    if (mpState.profile.mpPrestigeBonus > 0) {
      setMpPrestigeBonus(mpState.profile.mpPrestigeBonus);
    }
  } else {
    mpOverlayPlayer.classList.add('hidden');
  }

  // Grade badge on balance indicator
  if (mpState.profile && mpState.profile.grade && mpState.profile.grade !== 'none') {
    mpBalanceGrade.textContent = mpState.profile.grade;
    mpBalanceGrade.classList.remove('hidden');
  } else {
    mpBalanceGrade.classList.add('hidden');
  }
}

function updateRateButtons(activeRate) {
  mpOverlayRateBtns.forEach(function (btn) {
    if (Number(btn.dataset.rate) === activeRate) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });
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
    mp.profile = null;
    updateMultiplayerUI(mp);
  });
});

// --- Contribution rate buttons ---
mpOverlayRateBtns.forEach(function (btn) {
  btn.addEventListener('click', function (e) {
    e.stopPropagation();
    var rate = Number(btn.dataset.rate);
    setContributionRate(rate);
    updateRateButtons(rate);
  });
});

// --- Leaderboard ---
var currentLeaderboardSide = 'on';
var leaderboardData = null;

mpOverlayLeaderboardBtn.addEventListener('click', function (e) {
  e.stopPropagation();
  closeOverlay();
  openLeaderboard();
});

function openLeaderboard() {
  mpLeaderboard.classList.remove('hidden');
  fetchLeaderboard();
}

function closeLeaderboard() {
  mpLeaderboard.classList.add('hidden');
}

mpLeaderboardClose.addEventListener('click', function (e) {
  e.stopPropagation();
  closeLeaderboard();
});

mpLeaderboardBackdrop.addEventListener('click', function (e) {
  e.stopPropagation();
  closeLeaderboard();
});

mpLeaderboardTabs.forEach(function (tab) {
  tab.addEventListener('click', function (e) {
    e.stopPropagation();
    currentLeaderboardSide = tab.dataset.side;
    mpLeaderboardTabs.forEach(function (t) {
      t.classList.remove('active');
    });
    tab.classList.add('active');
    renderLeaderboard();
  });
});

function fetchLeaderboard(retries) {
  if (retries === undefined) retries = 2;
  mpLeaderboardList.innerHTML = '<div style="opacity:0.3;text-align:center;padding:20px;">Chargement\u2026</div>';
  fetch('/api/leaderboard')
    .then(function (res) {
      return res.json();
    })
    .then(function (data) {
      leaderboardData = data;
      mpLeaderboardTitle.textContent = 'Classement — Saison ' + (data.season || '');
      renderLeaderboard();
    })
    .catch(function () {
      if (retries > 0) {
        _st(function () {
          fetchLeaderboard(retries - 1);
        }, 2000);
      } else {
        mpLeaderboardList.innerHTML =
          '<div style="opacity:0.3;text-align:center;padding:20px;">Indisponible — réessayez plus tard</div>';
      }
    });
}

function renderLeaderboard() {
  if (!leaderboardData) return;

  var entries = currentLeaderboardSide === 'on' ? leaderboardData.light : leaderboardData.dark;
  mpLeaderboardList.innerHTML = '';

  if (!entries || entries.length === 0) {
    mpLeaderboardList.innerHTML = '<div style="opacity:0.3;text-align:center;padding:20px;">Aucun contributeur</div>';
  } else {
    entries.forEach(function (entry) {
      var el = document.createElement('div');
      el.className = 'mp-lb-entry';

      var rankEl = document.createElement('span');
      rankEl.className = 'mp-lb-rank';
      rankEl.textContent = '#' + entry.rank;

      var nameEl = document.createElement('span');
      nameEl.className = 'mp-lb-name';
      nameEl.textContent = entry.name;

      var totalEl = document.createElement('span');
      totalEl.className = 'mp-lb-total';
      totalEl.textContent = formatNumber(entry.total);

      el.appendChild(rankEl);

      if (entry.avatar) {
        var avatarEl = document.createElement('img');
        avatarEl.className = 'mp-lb-avatar';
        avatarEl.src = entry.avatar;
        avatarEl.alt = '';
        el.appendChild(avatarEl);
      }

      el.appendChild(nameEl);
      el.appendChild(totalEl);
      mpLeaderboardList.appendChild(el);
    });
  }

  // Player's own rank
  if (leaderboardData.playerRank && leaderboardData.playerRank.side === currentLeaderboardSide) {
    mpLeaderboardPlayerRank.textContent =
      'Votre rang : #' + leaderboardData.playerRank.rank + ' (' + formatNumber(leaderboardData.playerRank.total) + ')';
  } else {
    mpLeaderboardPlayerRank.textContent = '';
  }
}

// --- Season end events ---
onSeasonEnd(function (data) {
  showSeasonEndBroadcast(data);
});

// --- Unclaimed rewards (shown on connect) ---
onRewardReceived(function (rewards) {
  if (rewards.length > 0) {
    // Show the most recent unclaimed reward
    showSeasonEnd(rewards[0]);
  }
});

// --- Streak loss notification ---
onStreakChange(function (info) {
  if (!info.reset) return;
  // Show a brief toast notification about streak loss
  var toast = document.createElement('div');
  toast.className = 'mp-streak-toast';
  toast.textContent = 'Série perdue (' + info.oldStreak + 'j) — multiplieur réinitialisé';
  document.body.appendChild(toast);
  _st(function () {
    toast.classList.add('fade-out');
    _st(function () {
      toast.remove();
    }, 600);
  }, 4000);
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
  initMultiplayer()
    .then(function () {
      setServerAvailable(true);

      // If user is already logged in (returned from OAuth), mark onboarding done
      if (mp.user) {
        try {
          localStorage.setItem('light-mp-onboarding', 'connected');
        } catch (_) {}
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
    })
    .catch(function () {
      // Server not available — multiplayer stays invisible
      setServerAvailable(false);
    });
})();
