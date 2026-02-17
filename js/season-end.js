// === SeasonEnd — Season transition cinematic and reward claim ===
'use strict';

import { gameMode, setMpPrestigeBonus } from './state.js';
import { _st } from './utils.js';
import { mp, claimReward } from './multiplayer.js';

// --- DOM refs (lazy) ---
var overlay,
  title,
  result,
  statsLight,
  statsDark,
  playerGrade,
  playerContrib,
  playerRank,
  rewardText,
  rewardBonus,
  claimBtn,
  continueBtn;

function grabDOM() {
  overlay = document.getElementById('season-end-overlay');
  title = document.getElementById('season-end-title');
  result = document.getElementById('season-end-result');
  statsLight = document.getElementById('season-end-light');
  statsDark = document.getElementById('season-end-dark');
  playerGrade = document.getElementById('season-end-grade');
  playerContrib = document.getElementById('season-end-contrib');
  playerRank = document.getElementById('season-end-rank');
  rewardText = document.getElementById('season-end-reward-text');
  rewardBonus = document.getElementById('season-end-reward-bonus');
  claimBtn = document.getElementById('season-end-claim');
  continueBtn = document.getElementById('season-end-continue');
}

function formatShort(n) {
  if (n >= 1e12) return (n / 1e12).toFixed(1) + 'T';
  if (n >= 1e9) return (n / 1e9).toFixed(1) + 'B';
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
  return String(n);
}

/**
 * Show the season end overlay with reward data.
 * @param {object} reward - A season_rewards row joined with cosmic_war data
 */
export function showSeasonEnd(reward) {
  grabDOM();
  if (!overlay) return;

  var isOff = gameMode === 'off';
  var winnerLabel = reward.winner === 'light' ? 'La Lumière' : reward.winner === 'dark' ? "L'Ombre" : 'Égalité';

  title.textContent = 'Saison ' + reward.season + ' terminée';

  if (reward.winner === 'draw') {
    result.textContent = "Ni lumière ni ombre n'a triomphé.";
  } else if (reward.won) {
    result.textContent = winnerLabel + ' a triomphé — Victoire\u00a0!';
  } else {
    result.textContent = winnerLabel + ' a triomphé.';
  }

  statsLight.textContent = formatShort(Number(reward.total_light)) + ' lm';
  statsDark.textContent = formatShort(Number(reward.total_dark)) + ' ob';

  // Player stats
  if (reward.grade && reward.grade !== 'none') {
    playerGrade.textContent = 'Grade : ' + reward.grade;
  } else {
    playerGrade.textContent = '';
  }

  playerContrib.textContent = 'Contribution : ' + formatShort(Number(reward.contribution_total));

  if (reward.rank_in_team) {
    playerRank.textContent = 'Rang : #' + reward.rank_in_team + (reward.top_percent ? ' (Top 10%)' : '');
  } else {
    playerRank.textContent = '';
  }

  // Reward
  var bonus = Number(reward.prestige_bonus);
  if (bonus > 0) {
    rewardText.textContent = reward.won ? 'Récompense de victoire' : 'Récompense de participation';
    rewardBonus.textContent = '+' + bonus.toFixed(2) + ' prestige';
    rewardBonus.classList.remove('hidden');
    claimBtn.classList.remove('hidden');
    continueBtn.classList.add('hidden');
  } else {
    rewardText.textContent = 'Contribution insuffisante pour une récompense.';
    rewardBonus.classList.add('hidden');
    claimBtn.classList.add('hidden');
    continueBtn.classList.remove('hidden');
  }

  // Wire buttons
  claimBtn.onclick = function () {
    claimReward(reward.id);
    // Update local prestige bonus immediately
    if (mp.profile) {
      var newBonus = (mp.profile.mpPrestigeBonus || 0) + bonus;
      mp.profile.mpPrestigeBonus = newBonus;
      setMpPrestigeBonus(newBonus);
    }
    dismissSeasonEnd();
  };

  continueBtn.onclick = function () {
    dismissSeasonEnd();
  };

  // Show
  overlay.classList.remove('hidden');
}

function dismissSeasonEnd() {
  if (!overlay) return;
  overlay.classList.add('fade-out');
  _st(function () {
    overlay.classList.add('hidden');
    overlay.classList.remove('fade-out');
  }, 800);
}

/**
 * Show a live season-end broadcast (no personal reward yet — will come via socket).
 */
export function showSeasonEndBroadcast(data) {
  grabDOM();
  if (!overlay) return;

  var winnerLabel = data.winner === 'light' ? 'La Lumière' : data.winner === 'dark' ? "L'Ombre" : 'Égalité';

  title.textContent = 'Saison ' + data.endedSeason + ' terminée';
  result.textContent = winnerLabel + ' a triomphé\u00a0!';

  statsLight.textContent = formatShort(data.totalLight) + ' lm';
  statsDark.textContent = formatShort(data.totalDark) + ' ob';

  playerGrade.textContent = '';
  playerContrib.textContent = '';
  playerRank.textContent = '';
  rewardText.textContent = 'Saison ' + data.newSeason + ' commence\u2026';
  rewardBonus.classList.add('hidden');
  claimBtn.classList.add('hidden');
  continueBtn.classList.remove('hidden');

  continueBtn.onclick = function () {
    dismissSeasonEnd();
  };

  overlay.classList.remove('hidden');
}
