// === Onboarding — Progressive multiplayer introduction ===
'use strict';

import { gameMode, state } from './state.js';
import { _st } from './utils.js';
import { mp } from './multiplayer.js';

// --- Constants ---
var ONBOARDING_THRESHOLD = 60000; // totalLumens needed to trigger
var ONBOARDING_KEY = 'light-mp-onboarding'; // localStorage flag
var SKIP_DELAY = 3000; // ms before skip button appears

// --- State ---
var onboardingShown = false;
var onboardingDismissed = false;
var serverAvailable = false;

// --- DOM refs (lazy, grabbed once) ---
var overlay, orb, text1, text2, actions, skipBtn;

function grabDOM() {
  overlay = document.getElementById('mp-onboarding');
  orb = document.getElementById('mp-onboarding-orb');
  text1 = document.getElementById('mp-onboarding-text1');
  text2 = document.getElementById('mp-onboarding-text2');
  actions = document.getElementById('mp-onboarding-actions');
  skipBtn = document.getElementById('mp-onboarding-skip');
}

// --- Public: mark server as reachable ---
export function setServerAvailable(val) {
  serverAvailable = val;
  // If user already logged in (returning from OAuth), mark onboarding done
  if (val && mp.user) {
    markOnboardingDone('connected');
  }
}

// --- Public: was onboarding already completed? ---
export function isOnboardingDone() {
  try {
    var val = localStorage.getItem(ONBOARDING_KEY);
    return val === 'connected' || val === 'solo';
  } catch (_) {
    return false;
  }
}

// --- Public: did user choose to connect (vs solo)? ---
export function isMultiplayerActive() {
  try {
    return localStorage.getItem(ONBOARDING_KEY) === 'connected';
  } catch (_) {
    return false;
  }
}

function markOnboardingDone(choice) {
  try {
    localStorage.setItem(ONBOARDING_KEY, choice);
  } catch (_) {}
  onboardingDismissed = true;
}

// --- Public: check if onboarding should trigger ---
export function checkOnboarding() {
  if (onboardingShown || onboardingDismissed) return;
  if (isOnboardingDone()) {
    onboardingDismissed = true;
    return;
  }
  if (!serverAvailable) return;
  if (state.totalLumens < ONBOARDING_THRESHOLD) return;

  onboardingShown = true;
  showOnboarding();
}

// --- Onboarding cinematic ---
function showOnboarding() {
  grabDOM();
  if (!overlay) return;

  var isOff = gameMode === 'off';

  // Set text based on mode
  text1.textContent = 'Vous n\u2019êtes pas seul\u2026';
  if (isOff) {
    text2.textContent = 'L\u2019équilibre entre ombre et lumière est précaire.';
  } else {
    text2.textContent = 'L\u2019équilibre entre lumière et ombre est précaire.';
  }

  // Wire up buttons
  var googleBtn = document.getElementById('mp-onboarding-google');
  var discordBtn = document.getElementById('mp-onboarding-discord');
  var soloBtn = document.getElementById('mp-onboarding-solo');

  googleBtn.addEventListener('click', function (e) {
    e.stopPropagation();
    markOnboardingDone('connected');
    window.location.href = '/auth/google';
  });

  discordBtn.addEventListener('click', function (e) {
    e.stopPropagation();
    markOnboardingDone('connected');
    window.location.href = '/auth/discord';
  });

  soloBtn.addEventListener('click', function (e) {
    e.stopPropagation();
    dismissOnboarding('solo');
  });

  skipBtn.addEventListener('click', function (e) {
    e.stopPropagation();
    dismissOnboarding('solo');
  });

  // Show overlay
  overlay.classList.remove('hidden');

  // Staggered text appearance (handled by CSS animation delays)
  // Show skip after SKIP_DELAY
  _st(function () {
    skipBtn.classList.remove('hidden');
  }, SKIP_DELAY);

  // Show action buttons after text animations complete (~4s)
  _st(function () {
    actions.classList.remove('hidden');
  }, 4000);
}

function dismissOnboarding(choice) {
  if (onboardingDismissed) return;
  markOnboardingDone(choice);

  overlay.classList.add('fade-out');
  _st(function () {
    overlay.classList.add('hidden');
    overlay.classList.remove('fade-out');
    // Notify main.js that onboarding is done
    if (typeof window._onOnboardingDone === 'function') {
      window._onOnboardingDone(choice);
    }
  }, 800);
}
