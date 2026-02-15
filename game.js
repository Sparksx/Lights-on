// === LIGHTS ON — Clicker Game ===

(function () {
  'use strict';

  // --- State ---
  const state = {
    lumens: 0,
    totalLumens: 0,
    clickPower: 1,
    lumensPerSecond: 0,
    upgrades: {},
    victoryReached: false,
    sunPurchased: false,
  };

  // --- Constants ---
  const VICTORY_LUMENS = 200000;
  const SAVE_KEY = 'lights-on-save';

  // --- Upgrades Definition ---
  const UPGRADES = [
    {
      id: 'spark',
      name: 'Étincelle',
      desc: 'Frotte, et la lueur naît',
      baseCost: 50,
      costMultiplier: 1.4,
      type: 'passive',
      value: 1,
      maxCount: 50,
      unlockAt: 0,
    },
    {
      id: 'firefly',
      name: 'Luciole',
      desc: 'Cligne dans le noir',
      baseCost: 150,
      costMultiplier: 1.7,
      type: 'burst',
      value: 1,
      maxCount: 25,
      unlockAt: 80,
    },
    {
      id: 'candle',
      name: 'Bougie',
      desc: 'Elle fond pour que d\'autres y voient',
      baseCost: 400,
      costMultiplier: 1.5,
      type: 'passive',
      value: 5,
      maxCount: 30,
      unlockAt: 250,
    },
    {
      id: 'prism',
      name: 'Prisme',
      desc: 'Un rayon entre, sept en sortent',
      baseCost: 1000,
      costMultiplier: 1.9,
      type: 'click',
      value: 3,
      maxCount: 20,
      unlockAt: 600,
    },
    {
      id: 'lantern',
      name: 'Lanterne',
      desc: 'La flamme emprisonnée voyage',
      baseCost: 3000,
      costMultiplier: 1.5,
      type: 'passive',
      value: 20,
      maxCount: 25,
      unlockAt: 2000,
    },
    {
      id: 'lightning',
      name: 'Éclair',
      desc: 'Frappe et illumine',
      baseCost: 8000,
      costMultiplier: 2.0,
      type: 'click',
      value: 10,
      maxCount: 15,
      unlockAt: 5000,
    },
    {
      id: 'lighthouse',
      name: 'Phare',
      desc: 'Tourne sans fin pour les égarés',
      baseCost: 15000,
      costMultiplier: 1.6,
      type: 'passive',
      value: 80,
      maxCount: 20,
      unlockAt: 10000,
    },
    {
      id: 'aurora',
      name: 'Aurore',
      desc: 'Le vent solaire touche le ciel',
      baseCost: 40000,
      costMultiplier: 1.6,
      type: 'passive',
      value: 250,
      maxCount: 15,
      unlockAt: 25000,
    },
    {
      id: 'star',
      name: 'Étoile',
      desc: 'Quatre milliards d\'années de fusion',
      baseCost: 100000,
      costMultiplier: 1.7,
      type: 'passive',
      value: 800,
      maxCount: 10,
      unlockAt: 60000,
    },
    {
      id: 'sun',
      name: 'Soleil',
      desc: '?',
      baseCost: 200000,
      costMultiplier: 1,
      type: 'victory',
      value: 0,
      maxCount: 1,
      unlockAt: 150000,
    },
  ];

  // --- DOM refs ---
  const gameArea = document.getElementById('game-area');
  const canvas = document.getElementById('halo-canvas');
  const ctx = canvas.getContext('2d');
  const progressFill = document.getElementById('progress-fill');
  const upgradeToggle = document.getElementById('upgrade-toggle');
  const upgradePanel = document.getElementById('upgrade-panel');
  const upgradeClose = document.getElementById('upgrade-close');
  const upgradeList = document.getElementById('upgrade-list');
  const lumenCounter = document.getElementById('lumen-counter');
  const victoryScreen = document.getElementById('victory-screen');
  const restartBtn = document.getElementById('restart-btn');
  const switchContainer = document.getElementById('switch-container');
  const lightSwitch = document.getElementById('light-switch');
  const switchLever = document.getElementById('switch-lever');

  // --- Canvas setup ---
  const halos = [];

  function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }

  window.addEventListener('resize', resizeCanvas);
  resizeCanvas();

  // --- Halo system (water-drop ripple) ---
  function easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
  }

  function addHalo(x, y) {
    const progress = Math.min(state.totalLumens / VICTORY_LUMENS, 1);
    const intensity = 0.4 + progress * 0.6;
    const scale = 1 + progress * 2;

    // Central flash
    halos.push({
      type: 'glow',
      x, y,
      maxRadius: 25 * scale,
      opacity: intensity,
      life: 1.0,
      decay: 0.035,
      delay: 0,
    });

    // Expanding ripple rings
    for (let i = 0; i < 3; i++) {
      halos.push({
        type: 'ring',
        x, y,
        maxRadius: (80 + i * 40) * scale,
        opacity: intensity * (1 - i * 0.2),
        life: 1.0,
        decay: 0.012 + i * 0.002,
        delay: i * 6,
      });
    }

    // Persistent residual glow (slow fade)
    halos.push({
      type: 'persist',
      x, y,
      maxRadius: 45 * scale,
      opacity: 0.08 + progress * 0.06,
      life: 1.0,
      decay: 0.003,
      delay: 4,
    });
  }

  function updateHalos() {
    for (let i = halos.length - 1; i >= 0; i--) {
      const h = halos[i];

      if (h.delay > 0) {
        h.delay--;
        continue;
      }

      h.life -= h.decay;
      if (h.life <= 0) {
        halos.splice(i, 1);
      }
    }
  }

  function drawHalos() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (const h of halos) {
      if (h.delay > 0) continue;

      const alpha = h.opacity * Math.max(h.life, 0);
      if (alpha <= 0) continue;

      const t = 1 - h.life;
      const radius = h.maxRadius * easeOutCubic(t);

      if (h.type === 'glow') {
        const r = Math.max(radius, 1);
        const gradient = ctx.createRadialGradient(h.x, h.y, 0, h.x, h.y, r);
        gradient.addColorStop(0, `rgba(255, 255, 255, ${alpha})`);
        gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
        ctx.beginPath();
        ctx.arc(h.x, h.y, r, 0, Math.PI * 2);
        ctx.fillStyle = gradient;
        ctx.fill();
      } else if (h.type === 'ring') {
        if (radius < 1) continue;
        const lineWidth = Math.max(0.5, 1.5 * h.life);
        ctx.beginPath();
        ctx.arc(h.x, h.y, radius, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(255, 255, 255, ${alpha})`;
        ctx.lineWidth = lineWidth;
        ctx.stroke();
      } else if (h.type === 'persist') {
        // Soft lingering glow — fixed size, fades slowly
        const r = h.maxRadius;
        const gradient = ctx.createRadialGradient(h.x, h.y, 0, h.x, h.y, r);
        gradient.addColorStop(0, `rgba(255, 255, 255, ${alpha * 0.7})`);
        gradient.addColorStop(0.4, `rgba(255, 255, 255, ${alpha * 0.3})`);
        gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
        ctx.beginPath();
        ctx.arc(h.x, h.y, r, 0, Math.PI * 2);
        ctx.fillStyle = gradient;
        ctx.fill();
      } else if (h.type === 'combo-text') {
        // Floating combo multiplier text
        const floatY = h.y - (1 - h.life) * 40;
        ctx.save();
        ctx.font = 'bold 16px "Courier New", monospace';
        ctx.textAlign = 'center';
        ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
        ctx.fillText(h.text, h.x, floatY);
        ctx.restore();
      } else if (h.type === 'edge') {
        // Vignette glow from screen edges
        const w = canvas.width;
        const ht = canvas.height;
        const thickness = h.maxRadius;
        // Top
        const topG = ctx.createLinearGradient(0, 0, 0, thickness);
        topG.addColorStop(0, `rgba(255, 255, 255, ${alpha})`);
        topG.addColorStop(1, 'rgba(255, 255, 255, 0)');
        ctx.fillStyle = topG;
        ctx.fillRect(0, 0, w, thickness);
        // Bottom
        const botG = ctx.createLinearGradient(0, ht, 0, ht - thickness);
        botG.addColorStop(0, `rgba(255, 255, 255, ${alpha})`);
        botG.addColorStop(1, 'rgba(255, 255, 255, 0)');
        ctx.fillStyle = botG;
        ctx.fillRect(0, ht - thickness, w, thickness);
        // Left
        const leftG = ctx.createLinearGradient(0, 0, thickness, 0);
        leftG.addColorStop(0, `rgba(255, 255, 255, ${alpha})`);
        leftG.addColorStop(1, 'rgba(255, 255, 255, 0)');
        ctx.fillStyle = leftG;
        ctx.fillRect(0, 0, thickness, ht);
        // Right
        const rightG = ctx.createLinearGradient(w, 0, w - thickness, 0);
        rightG.addColorStop(0, `rgba(255, 255, 255, ${alpha})`);
        rightG.addColorStop(1, 'rgba(255, 255, 255, 0)');
        ctx.fillStyle = rightG;
        ctx.fillRect(w - thickness, 0, thickness, ht);
      }
    }
  }

  // --- Edge glow (upgrade reward) ---
  function addEdgeGlow() {
    halos.push({
      type: 'edge',
      x: 0, y: 0,
      maxRadius: 100,
      opacity: 0.10,
      life: 1.0,
      decay: 0.008,
      delay: 0,
    });
  }

  // --- Rubbing/swiping mechanic ---
  let isRubbing = false;
  let lastRubX = 0;
  let lastRubY = 0;
  let rubDistance = 0;
  const RUB_THRESHOLD = 20; // pixels of movement to generate lumens

  function startRub(x, y) {
    if (state.victoryReached || state.sunPurchased || sunCinematicActive) return;
    isRubbing = true;
    lastRubX = x;
    lastRubY = y;
    rubDistance = 0;
  }

  function moveRub(x, y) {
    if (!isRubbing || state.victoryReached || state.sunPurchased || sunCinematicActive) return;
    if (getUpgradeCount('spark') === 0) return;
    const dx = x - lastRubX;
    const dy = y - lastRubY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    rubDistance += dist;
    lastRubX = x;
    lastRubY = y;

    // Generate small sparks along the rub path
    if (rubDistance >= RUB_THRESHOLD) {
      const rubPower = Math.max(1, Math.floor(state.clickPower * 0.3));
      state.lumens += rubPower;
      state.totalLumens += rubPower;
      rubDistance -= RUB_THRESHOLD;

      // Small spark particle
      halos.push({
        type: 'glow',
        x, y,
        maxRadius: 8 + Math.random() * 12,
        opacity: 0.3 + Math.random() * 0.3,
        life: 1.0,
        decay: 0.06,
        delay: 0,
      });

      checkMilestones();
      updateUI();
    }
  }

  function endRub() {
    isRubbing = false;
    rubDistance = 0;
  }

  gameArea.addEventListener('mousedown', function (e) {
    if (e.target.closest('#upgrade-panel') || e.target.closest('#upgrade-toggle') || e.target.closest('#switch-container')) return;
    startRub(e.clientX, e.clientY);
    startPrismHold(e.clientX, e.clientY);
  });
  gameArea.addEventListener('mousemove', function (e) {
    if (e.target.closest('#upgrade-panel')) return;
    moveRub(e.clientX, e.clientY);
    movePrismHold(e.clientX, e.clientY);
  });
  gameArea.addEventListener('mouseup', function () { endRub(); endPrismHold(); });
  gameArea.addEventListener('mouseleave', function () { endRub(); endPrismHold(); });

  gameArea.addEventListener('touchmove', function (e) {
    if (e.target.closest('#upgrade-panel')) return;
    e.preventDefault();
    const touch = e.touches[0];
    moveRub(touch.clientX, touch.clientY);
    movePrismHold(touch.clientX, touch.clientY);
  }, { passive: false });

  gameArea.addEventListener('touchend', function () { endRub(); endPrismHold(); });
  gameArea.addEventListener('touchcancel', function () { endRub(); endPrismHold(); });

  // --- Combo system ---
  let comboCount = 0;
  let comboTimer = null;
  const COMBO_WINDOW = 800; // ms between clicks to maintain combo
  const COMBO_DECAY = 2000; // ms before combo fully resets

  function getComboMultiplier() {
    if (comboCount < 3) return 1;
    if (comboCount < 8) return 1.5;
    if (comboCount < 15) return 2;
    if (comboCount < 25) return 3;
    return 5;
  }

  function showComboText(x, y, multiplier, lumens) {
    // Floating text showing combo info
    halos.push({
      type: 'combo-text',
      x, y: y - 20,
      text: multiplier > 1 ? 'x' + multiplier + ' !' : '+' + lumens,
      opacity: 1.0,
      life: 1.0,
      decay: 0.02,
      delay: 0,
      maxRadius: 0,
    });
  }

  // --- Click handler ---
  function handleClick(e) {
    if (state.victoryReached || state.sunPurchased || sunCinematicActive) return;

    // Don't count clicks on UI elements
    if (e.target.closest('#upgrade-panel') || e.target.closest('#upgrade-toggle') || e.target.closest('#switch-container')) return;

    const x = e.clientX || (e.touches && e.touches[0].clientX);
    const y = e.clientY || (e.touches && e.touches[0].clientY);

    if (x === undefined || y === undefined) return;

    // Check if clicking a light burst orb
    clickLightBurst(x, y);

    // Combo tracking
    comboCount++;
    if (comboTimer) clearTimeout(comboTimer);
    comboTimer = setTimeout(function () {
      comboCount = 0;
    }, COMBO_DECAY);

    const multiplier = getComboMultiplier();
    const gain = Math.floor(state.clickPower * multiplier);

    state.lumens += gain;
    state.totalLumens += gain;

    addHalo(x, y);
    if (multiplier > 1) {
      showComboText(x, y, multiplier, gain);
    }
    checkMilestones();
    updateUI();
  }

  gameArea.addEventListener('click', handleClick);
  gameArea.addEventListener('touchstart', function (e) {
    if (e.target.closest('#upgrade-panel') || e.target.closest('#upgrade-toggle') || e.target.closest('#victory-screen') || e.target.closest('#switch-container')) return;
    e.preventDefault();
    const touch = e.touches[0];
    startRub(touch.clientX, touch.clientY);
    startPrismHold(touch.clientX, touch.clientY);
    handleClick({ clientX: touch.clientX, clientY: touch.clientY, target: e.target });
  }, { passive: false });

  // --- Upgrade system ---
  function getUpgradeCount(id) {
    return state.upgrades[id] || 0;
  }

  function getUpgradeCost(upgrade) {
    const count = getUpgradeCount(upgrade.id);
    return Math.floor(upgrade.baseCost * Math.pow(upgrade.costMultiplier, count));
  }

  function buyUpgrade(upgrade) {
    const cost = getUpgradeCost(upgrade);
    const count = getUpgradeCount(upgrade.id);

    if (state.lumens < cost) return;
    if (count >= upgrade.maxCount) return;

    state.lumens -= cost;
    state.upgrades[upgrade.id] = count + 1;

    if (upgrade.type === 'click') {
      state.clickPower += upgrade.value;
    } else if (upgrade.type === 'victory') {
      state.sunPurchased = true;
      closeUpgradePanel();
      upgradeToggle.classList.add('hidden');
      showSwitch();
      save();
      return;
    }

    pendingReward = true;
    recalcPassive();
    renderUpgrades();
    updateUI();

    // Auto-close if no more affordable upgrades
    if (!hasAffordableUpgrade()) {
      closeUpgradePanel();
    }
  }

  function hasAffordableUpgrade() {
    for (const up of UPGRADES) {
      const count = getUpgradeCount(up.id);
      if (count >= up.maxCount) continue;
      if (state.totalLumens < up.unlockAt) continue;
      if (state.lumens >= getUpgradeCost(up)) return true;
    }
    return false;
  }

  function recalcPassive() {
    let lps = 0;
    for (const up of UPGRADES) {
      if (up.type === 'passive') {
        lps += up.value * getUpgradeCount(up.id);
      }
    }
    state.lumensPerSecond = lps;
  }

  function renderUpgrades() {
    lumenCounter.textContent = formatNumber(Math.floor(state.lumens)) + ' lm';
    upgradeList.innerHTML = '';

    let nextShown = false; // only show one upcoming unpurchased upgrade

    for (const up of UPGRADES) {
      const count = getUpgradeCount(up.id);
      const unlocked = state.totalLumens >= up.unlockAt;

      // Show purchased upgrades always
      if (count === 0) {
        // Not purchased: show only the next unlocked one
        if (!unlocked || nextShown) continue;
        nextShown = true;
      }

      const cost = getUpgradeCost(up);
      const canAfford = state.lumens >= cost;
      const isMaxed = count >= up.maxCount;

      const item = document.createElement('div');
      item.className = 'upgrade-item';
      if (isMaxed) {
        item.classList.add('maxed');
      } else if (!canAfford) {
        item.classList.add('locked');
      } else {
        item.classList.add('affordable');
      }

      item.innerHTML = `
        <div class="upgrade-name">${up.name}</div>
        <div class="upgrade-desc">${up.desc}</div>
        <div class="upgrade-cost">${isMaxed ? 'MAX' : formatNumber(cost) + ' lm'}</div>
        ${count > 0 ? `<div class="upgrade-count">x${count}</div>` : ''}
      `;

      if (!isMaxed && canAfford) {
        item.addEventListener('click', function (e) {
          e.stopPropagation();
          buyUpgrade(up);
        });
      }

      upgradeList.appendChild(item);
    }
  }

  // --- Milestones ---
  let upgradeUnlocked = false;

  function checkMilestones() {
    if (!upgradeUnlocked && state.totalLumens >= 50) {
      upgradeUnlocked = true;
      upgradeToggle.classList.remove('hidden');
    }
  }

  // --- UI update ---
  function updateUI() {
    const progress = Math.min(state.totalLumens / VICTORY_LUMENS, 1);
    progressFill.style.width = (progress * 100) + '%';
  }

  // --- Switch interaction ---
  let sunCinematicActive = false;
  let sunCinematicProgress = 0;

  function showSwitch() {
    switchContainer.classList.remove('hidden');
  }

  lightSwitch.addEventListener('click', function (e) {
    e.stopPropagation();
    if (!state.sunPurchased || sunCinematicActive) return;

    // Flip the switch
    switchLever.classList.add('on');

    // Start the sun cinematic after a brief pause
    setTimeout(function () {
      switchContainer.classList.add('hidden');
      playSunCinematic();
    }, 600);
  });

  // --- Sun cinematic ---
  function playSunCinematic() {
    sunCinematicActive = true;
    sunCinematicProgress = 0;

    // Clear existing effects
    halos.length = 0;
    lightBursts.length = 0;
    prismRays.length = 0;

    // Create cinematic canvas
    const cinCanvas = document.createElement('canvas');
    cinCanvas.id = 'sun-cinematic';
    cinCanvas.width = window.innerWidth;
    cinCanvas.height = window.innerHeight;
    cinCanvas.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;z-index:45;pointer-events:none;';
    gameArea.appendChild(cinCanvas);
    const cinCtx = cinCanvas.getContext('2d');

    const centerX = cinCanvas.width / 2;
    const centerY = cinCanvas.height * 0.35;
    const maxRadius = Math.max(cinCanvas.width, cinCanvas.height) * 1.5;

    // Phase 1: Sun appears and grows (0 -> 0.4)
    // Phase 2: Rays expand outward (0.3 -> 0.7)
    // Phase 3: Screen fills with white (0.6 -> 1.0)

    function animateCinematic() {
      sunCinematicProgress += 0.003;

      cinCtx.clearRect(0, 0, cinCanvas.width, cinCanvas.height);

      if (sunCinematicProgress < 1.0) {
        // Phase 1: Growing sun core
        if (sunCinematicProgress < 0.5) {
          const phase1 = sunCinematicProgress / 0.5;
          const sunRadius = easeOutCubic(phase1) * 60;
          const glowRadius = easeOutCubic(phase1) * 200;
          const alpha = easeOutCubic(phase1);

          // Outer warm glow
          const outerGlow = cinCtx.createRadialGradient(centerX, centerY, 0, centerX, centerY, glowRadius);
          outerGlow.addColorStop(0, 'rgba(255, 240, 200, ' + (alpha * 0.4) + ')');
          outerGlow.addColorStop(0.3, 'rgba(255, 220, 150, ' + (alpha * 0.2) + ')');
          outerGlow.addColorStop(1, 'rgba(255, 200, 100, 0)');
          cinCtx.beginPath();
          cinCtx.arc(centerX, centerY, glowRadius, 0, Math.PI * 2);
          cinCtx.fillStyle = outerGlow;
          cinCtx.fill();

          // Sun core
          const coreGlow = cinCtx.createRadialGradient(centerX, centerY, 0, centerX, centerY, sunRadius);
          coreGlow.addColorStop(0, 'rgba(255, 255, 255, ' + alpha + ')');
          coreGlow.addColorStop(0.6, 'rgba(255, 250, 230, ' + (alpha * 0.8) + ')');
          coreGlow.addColorStop(1, 'rgba(255, 240, 200, 0)');
          cinCtx.beginPath();
          cinCtx.arc(centerX, centerY, sunRadius, 0, Math.PI * 2);
          cinCtx.fillStyle = coreGlow;
          cinCtx.fill();
        }

        // Phase 2: Rays burst from sun
        if (sunCinematicProgress >= 0.25 && sunCinematicProgress < 0.75) {
          const phase2 = (sunCinematicProgress - 0.25) / 0.5;
          const rayCount = 12;
          const rayLength = easeOutCubic(phase2) * maxRadius * 0.6;
          const rayAlpha = Math.min(phase2 * 2, 1) * (1 - Math.max(0, (phase2 - 0.7) / 0.3));

          for (let i = 0; i < rayCount; i++) {
            const angle = (i / rayCount) * Math.PI * 2 + sunCinematicProgress * 0.5;
            const endX = centerX + Math.cos(angle) * rayLength;
            const endY = centerY + Math.sin(angle) * rayLength;

            const rayGrad = cinCtx.createLinearGradient(centerX, centerY, endX, endY);
            rayGrad.addColorStop(0, 'rgba(255, 255, 240, ' + (rayAlpha * 0.8) + ')');
            rayGrad.addColorStop(1, 'rgba(255, 255, 240, 0)');

            cinCtx.beginPath();
            cinCtx.moveTo(centerX, centerY);
            cinCtx.lineTo(endX, endY);
            cinCtx.strokeStyle = rayGrad;
            cinCtx.lineWidth = 3 + phase2 * 8;
            cinCtx.stroke();
          }

          // Persistent sun core during rays
          const sunR = 60 + phase2 * 30;
          const coreGlow = cinCtx.createRadialGradient(centerX, centerY, 0, centerX, centerY, sunR);
          coreGlow.addColorStop(0, 'rgba(255, 255, 255, 1)');
          coreGlow.addColorStop(0.5, 'rgba(255, 250, 230, 0.9)');
          coreGlow.addColorStop(1, 'rgba(255, 240, 200, 0)');
          cinCtx.beginPath();
          cinCtx.arc(centerX, centerY, sunR, 0, Math.PI * 2);
          cinCtx.fillStyle = coreGlow;
          cinCtx.fill();
        }

        // Phase 3: White flood fills the screen
        if (sunCinematicProgress >= 0.55) {
          const phase3 = (sunCinematicProgress - 0.55) / 0.45;
          const floodRadius = easeOutCubic(phase3) * maxRadius;
          const floodAlpha = easeOutCubic(phase3);

          const flood = cinCtx.createRadialGradient(centerX, centerY, 0, centerX, centerY, floodRadius);
          flood.addColorStop(0, 'rgba(255, 255, 255, ' + floodAlpha + ')');
          flood.addColorStop(0.6, 'rgba(255, 255, 255, ' + (floodAlpha * 0.8) + ')');
          flood.addColorStop(1, 'rgba(255, 255, 255, ' + (floodAlpha * 0.3) + ')');
          cinCtx.beginPath();
          cinCtx.arc(centerX, centerY, floodRadius, 0, Math.PI * 2);
          cinCtx.fillStyle = flood;
          cinCtx.fill();
        }

        requestAnimationFrame(animateCinematic);
      } else {
        // Cinematic done — fill white then show victory
        cinCtx.fillStyle = '#fff';
        cinCtx.fillRect(0, 0, cinCanvas.width, cinCanvas.height);

        setTimeout(function () {
          cinCanvas.remove();
          sunCinematicActive = false;
          triggerVictory();
        }, 800);
      }
    }

    requestAnimationFrame(animateCinematic);
  }

  // --- Victory ---
  function triggerVictory() {
    state.victoryReached = true;
    victoryScreen.classList.remove('hidden');
    save();
  }

  // --- Restart ---
  restartBtn.addEventListener('click', function (e) {
    e.stopPropagation();
    localStorage.removeItem(SAVE_KEY);
    state.lumens = 0;
    state.totalLumens = 0;
    state.clickPower = 1;
    state.lumensPerSecond = 0;
    state.upgrades = {};
    state.victoryReached = false;
    state.sunPurchased = false;
    sunCinematicActive = false;
    upgradeUnlocked = false;
    upgradeToggle.classList.add('hidden');
    upgradePanel.classList.remove('open');
    victoryScreen.classList.add('hidden');
    switchContainer.classList.add('hidden');
    switchLever.classList.remove('on');
    halos.length = 0;
    lightBursts.length = 0;
    prismRays.length = 0;
    prismHolding = false;
    comboCount = 0;
    updateUI();
    renderUpgrades();
  });

  // --- Reset button ---
  const resetBtn = document.getElementById('reset-btn');
  resetBtn.addEventListener('click', function (e) {
    e.stopPropagation();
    localStorage.removeItem(SAVE_KEY);
    state.lumens = 0;
    state.totalLumens = 0;
    state.clickPower = 1;
    state.lumensPerSecond = 0;
    state.upgrades = {};
    state.victoryReached = false;
    state.sunPurchased = false;
    sunCinematicActive = false;
    upgradeUnlocked = false;
    upgradeToggle.classList.add('hidden');
    upgradePanel.classList.remove('open');
    victoryScreen.classList.add('hidden');
    switchContainer.classList.add('hidden');
    switchLever.classList.remove('on');
    halos.length = 0;
    lightBursts.length = 0;
    prismRays.length = 0;
    prismHolding = false;
    comboCount = 0;
    updateUI();
    renderUpgrades();
  });

  // --- Upgrade panel toggle ---
  let pendingReward = false;

  function closeUpgradePanel() {
    upgradePanel.classList.remove('open');
    if (pendingReward) {
      pendingReward = false;
      addEdgeGlow();
    }
  }

  upgradeToggle.addEventListener('click', function (e) {
    e.stopPropagation();
    if (upgradePanel.classList.contains('open')) {
      closeUpgradePanel();
    } else {
      upgradePanel.classList.add('open');
      renderUpgrades();
    }
  });

  upgradeClose.addEventListener('click', function (e) {
    e.stopPropagation();
    closeUpgradePanel();
  });

  // --- Light burst events (collectible orbs) ---
  const lightBursts = [];
  let nextBurstTime = Date.now() + 8000 + Math.random() * 12000;

  function spawnLightBurst() {
    const margin = 60;
    const x = margin + Math.random() * (canvas.width - margin * 2);
    const y = margin + Math.random() * (canvas.height - margin * 2);
    const baseBonus = Math.max(10, Math.floor(state.totalLumens * 0.03));
    const bonus = baseBonus + Math.floor(Math.random() * baseBonus);

    // Random initial wander direction
    const angle = Math.random() * Math.PI * 2;
    const speed = 0.3 + Math.random() * 0.4; // slow drift

    lightBursts.push({
      x, y,
      radius: 20,
      bonus: bonus,
      life: 1.0,
      decay: 0.002, // ~8 seconds to disappear
      pulse: 0,
      // Firefly movement properties
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      wanderAngle: angle,
      wanderSpeed: speed,
      flickerPhase: Math.random() * Math.PI * 2, // desync flicker per firefly
      restTimer: 0, // fireflies pause briefly
    });
  }

  function checkBurstSpawn() {
    if (state.victoryReached || state.sunPurchased) return;
    if (getUpgradeCount('firefly') === 0) return;
    if (Date.now() >= nextBurstTime && lightBursts.length < 3) {
      spawnLightBurst();
      nextBurstTime = Date.now() + 10000 + Math.random() * 15000;
    }
  }

  function updateLightBursts() {
    const margin = 30;
    for (let i = lightBursts.length - 1; i >= 0; i--) {
      const b = lightBursts[i];
      b.life -= b.decay;
      b.pulse += 0.05;
      if (b.life <= 0) {
        lightBursts.splice(i, 1);
        continue;
      }

      // --- Firefly organic movement ---
      // Rest timer: fireflies occasionally pause
      if (b.restTimer > 0) {
        b.restTimer -= 1;
        // While resting, slow down gradually
        b.vx *= 0.92;
        b.vy *= 0.92;
      } else {
        // Randomly decide to rest (like a real firefly pausing)
        if (Math.random() < 0.003) {
          b.restTimer = 30 + Math.random() * 60; // pause 0.5-1.5s at 60fps
        }

        // Wander: gently rotate direction with random perturbation
        b.wanderAngle += (Math.random() - 0.5) * 0.3;
        // Occasional sharper turns (firefly-like darting)
        if (Math.random() < 0.02) {
          b.wanderAngle += (Math.random() - 0.5) * 1.5;
        }

        // Smoothly steer toward wander angle
        const targetVx = Math.cos(b.wanderAngle) * b.wanderSpeed;
        const targetVy = Math.sin(b.wanderAngle) * b.wanderSpeed;
        b.vx += (targetVx - b.vx) * 0.08;
        b.vy += (targetVy - b.vy) * 0.08;
      }

      // Apply velocity
      b.x += b.vx;
      b.y += b.vy;

      // Soft boundary steering — gently push back toward center
      if (b.x < margin) { b.wanderAngle = 0; b.x = margin; }
      if (b.x > canvas.width - margin) { b.wanderAngle = Math.PI; b.x = canvas.width - margin; }
      if (b.y < margin) { b.wanderAngle = Math.PI / 2; b.y = margin; }
      if (b.y > canvas.height - margin) { b.wanderAngle = -Math.PI / 2; b.y = canvas.height - margin; }
    }
  }

  function drawLightBursts() {
    for (const b of lightBursts) {
      const lifeFade = Math.min(b.life * 2, 1); // fade in then out

      // Firefly flicker: organic bioluminescent blinking
      const flickerBase = Math.sin(b.pulse * 1.2 + b.flickerPhase);
      const flickerFast = Math.sin(b.pulse * 3.7 + b.flickerPhase * 2.3);
      // Combine slow pulse with occasional rapid flicker
      const flicker = 0.5 + 0.35 * flickerBase + 0.15 * flickerFast;
      const alpha = lifeFade * flicker;

      const pulseScale = 1 + 0.15 * Math.sin(b.pulse);
      const r = b.radius * pulseScale;

      // Warm firefly glow (slight yellow-green tint)
      const outerR = 255, outerG = 255, outerB = 220;
      const coreR = 255, coreG = 255, coreB = 240;

      // Outer glow — warm halo
      const gradient = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, r * 2.5);
      gradient.addColorStop(0, `rgba(${outerR}, ${outerG}, ${outerB}, ${alpha * 0.4})`);
      gradient.addColorStop(0.4, `rgba(${outerR}, ${outerG}, ${outerB}, ${alpha * 0.12})`);
      gradient.addColorStop(1, `rgba(${outerR}, ${outerG}, ${outerB}, 0)`);
      ctx.beginPath();
      ctx.arc(b.x, b.y, r * 2.5, 0, Math.PI * 2);
      ctx.fillStyle = gradient;
      ctx.fill();

      // Core — bright center
      const core = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, r * 0.7);
      core.addColorStop(0, `rgba(${coreR}, ${coreG}, ${coreB}, ${alpha * 0.9})`);
      core.addColorStop(1, `rgba(${coreR}, ${coreG}, ${coreB}, ${alpha * 0.15})`);
      ctx.beginPath();
      ctx.arc(b.x, b.y, r * 0.7, 0, Math.PI * 2);
      ctx.fillStyle = core;
      ctx.fill();
    }
  }

  function clickLightBurst(x, y) {
    for (let i = lightBursts.length - 1; i >= 0; i--) {
      const b = lightBursts[i];
      const dx = x - b.x;
      const dy = y - b.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist <= b.radius * 3) {
        // Collected!
        state.lumens += b.bonus;
        state.totalLumens += b.bonus;

        // Burst effect
        halos.push({
          type: 'glow',
          x: b.x, y: b.y,
          maxRadius: 80,
          opacity: 0.8,
          life: 1.0,
          decay: 0.02,
          delay: 0,
        });

        // Show bonus text
        halos.push({
          type: 'combo-text',
          x: b.x, y: b.y - 20,
          text: '+' + formatNumber(b.bonus) + ' !',
          opacity: 1.0,
          life: 1.0,
          decay: 0.015,
          delay: 0,
          maxRadius: 0,
        });

        lightBursts.splice(i, 1);
        checkMilestones();
        updateUI();
        return true;
      }
    }
    return false;
  }

  // --- Prism ray mechanic ---
  const prismRays = [];
  let nextRayTime = Date.now() + 15000 + Math.random() * 20000;
  let prismHolding = false;
  let prismHoldX = 0;
  let prismHoldY = 0;

  // Rainbow colors for the prism dispersion effect
  const RAINBOW = [
    'rgba(255, 0, 0, ',      // red
    'rgba(255, 127, 0, ',    // orange
    'rgba(255, 255, 0, ',    // yellow
    'rgba(0, 255, 0, ',      // green
    'rgba(0, 127, 255, ',    // blue
    'rgba(75, 0, 130, ',     // indigo
    'rgba(148, 0, 211, ',    // violet
  ];

  function spawnPrismRay() {
    const w = canvas.width;
    const h = canvas.height;

    // Choose a random trajectory across the screen
    // Pick two edges for start/end
    const side = Math.floor(Math.random() * 4);
    let startX, startY, endX, endY;

    if (side === 0) { // start from left
      startX = -10;
      startY = h * 0.2 + Math.random() * h * 0.6;
      endX = w + 10;
      endY = h * 0.2 + Math.random() * h * 0.6;
    } else if (side === 1) { // start from top
      startX = w * 0.2 + Math.random() * w * 0.6;
      startY = -10;
      endX = w * 0.2 + Math.random() * w * 0.6;
      endY = h + 10;
    } else if (side === 2) { // start from right
      startX = w + 10;
      startY = h * 0.2 + Math.random() * h * 0.6;
      endX = -10;
      endY = h * 0.2 + Math.random() * h * 0.6;
    } else { // start from bottom
      startX = w * 0.2 + Math.random() * w * 0.6;
      startY = h + 10;
      endX = w * 0.2 + Math.random() * w * 0.6;
      endY = -10;
    }

    // Duration scales with prism count: more prisms = ray lasts longer
    const prismCount = getUpgradeCount('prism');
    const baseDuration = 6; // seconds
    const bonusDuration = Math.min(prismCount * 0.5, 6);
    const totalDuration = baseDuration + bonusDuration;

    prismRays.push({
      startX, startY,
      endX, endY,
      life: 1.0,
      decay: 1 / (totalDuration * 60), // 60fps
      active: false,        // is player holding on it?
      holdTime: 0,          // total time held (frames)
      dispersePhase: 0,     // animation phase for rainbow effect
      lumensGenerated: 0,   // track total generated
      fadeOutSpeed: 0,       // accelerated fade when released
    });
  }

  function checkRaySpawn() {
    if (state.victoryReached || state.sunPurchased) return;
    if (getUpgradeCount('prism') === 0) return;
    if (Date.now() >= nextRayTime && prismRays.length < 2) {
      spawnPrismRay();
      // More prisms = more frequent rays
      const prismCount = getUpgradeCount('prism');
      const interval = Math.max(8000, 20000 - prismCount * 800);
      nextRayTime = Date.now() + interval + Math.random() * interval * 0.5;
    }
  }

  // Check if a point is near the ray line
  function pointToRayDistance(px, py, ray) {
    const dx = ray.endX - ray.startX;
    const dy = ray.endY - ray.startY;
    const lenSq = dx * dx + dy * dy;
    if (lenSq === 0) return { dist: Infinity, cx: ray.startX, cy: ray.startY, t: 0 };

    // Project point onto line, clamped to [0,1]
    let t = ((px - ray.startX) * dx + (py - ray.startY) * dy) / lenSq;
    t = Math.max(0, Math.min(1, t));

    const closestX = ray.startX + t * dx;
    const closestY = ray.startY + t * dy;

    const distX = px - closestX;
    const distY = py - closestY;
    return { dist: Math.sqrt(distX * distX + distY * distY), cx: closestX, cy: closestY, t: t };
  }

  function updatePrismRays() {
    for (let i = prismRays.length - 1; i >= 0; i--) {
      const ray = prismRays[i];

      // Check if player is holding on this ray
      ray.active = false;
      if (prismHolding && ray.life > 0.05) {
        const result = pointToRayDistance(prismHoldX, prismHoldY, ray);
        if (result.dist < 50) { // 50px touch zone around the ray
          ray.active = true;
          ray.holdTime++;
          ray.dispersePhase += 0.08;
          ray.fadeOutSpeed = 0; // reset accelerated fade

          // Generate lumens! More prisms = more lumens per tick
          const prismCount = getUpgradeCount('prism');
          const baseLumens = 0.5 + prismCount * 0.3;
          // Ramp up generation over time held (rewards sustained hold)
          const holdBonus = Math.min(ray.holdTime / 120, 2); // ramps over 2s, max 2x
          const gain = baseLumens * (1 + holdBonus);

          state.lumens += gain;
          state.totalLumens += gain;
          ray.lumensGenerated += gain;

          // The ray drains faster while being used (player extracts its energy)
          ray.life -= ray.decay * 1.5;

          checkMilestones();
          updateUI();
        }
      }

      // Natural decay
      ray.life -= ray.decay;

      // When life runs low, fade accelerates
      if (ray.life < 0.2) {
        ray.life -= ray.decay * 2;
      }

      if (ray.life <= 0) {
        prismRays.splice(i, 1);
      }
    }
  }

  function drawPrismRays() {
    for (const ray of prismRays) {
      const alpha = Math.min(ray.life * 3, 1) * 0.8; // quick fade-in, slow fade-out
      if (alpha <= 0) continue;

      // Draw the base white ray
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(ray.startX, ray.startY);
      ctx.lineTo(ray.endX, ray.endY);

      // Ray width pulses gently
      const widthPulse = 1 + 0.2 * Math.sin(ray.dispersePhase * 0.5);
      const baseWidth = ray.active ? 3 * widthPulse : 2 * widthPulse;

      // Create gradient along the ray
      const grad = ctx.createLinearGradient(ray.startX, ray.startY, ray.endX, ray.endY);
      grad.addColorStop(0, `rgba(255, 255, 255, 0)`);
      grad.addColorStop(0.15, `rgba(255, 255, 255, ${alpha})`);
      grad.addColorStop(0.85, `rgba(255, 255, 255, ${alpha})`);
      grad.addColorStop(1, `rgba(255, 255, 255, 0)`);
      ctx.strokeStyle = grad;
      ctx.lineWidth = baseWidth;
      ctx.stroke();

      // Soft glow around the ray
      ctx.beginPath();
      ctx.moveTo(ray.startX, ray.startY);
      ctx.lineTo(ray.endX, ray.endY);
      ctx.strokeStyle = `rgba(255, 255, 255, ${alpha * 0.15})`;
      ctx.lineWidth = baseWidth * 6;
      ctx.stroke();

      // If active (player holding), draw rainbow dispersion
      if (ray.active && prismHolding) {
        const result = pointToRayDistance(prismHoldX, prismHoldY, ray);

        // Draw prism point glow
        const prismGlow = ctx.createRadialGradient(
          result.cx, result.cy, 0,
          result.cx, result.cy, 60
        );
        prismGlow.addColorStop(0, `rgba(255, 255, 255, ${alpha * 0.9})`);
        prismGlow.addColorStop(0.3, `rgba(255, 255, 255, ${alpha * 0.3})`);
        prismGlow.addColorStop(1, 'rgba(255, 255, 255, 0)');
        ctx.beginPath();
        ctx.arc(result.cx, result.cy, 60, 0, Math.PI * 2);
        ctx.fillStyle = prismGlow;
        ctx.fill();

        // Rainbow dispersion rays fanning out from the touch point
        const rayDx = ray.endX - ray.startX;
        const rayDy = ray.endY - ray.startY;
        const rayAngle = Math.atan2(rayDy, rayDx);
        // Perpendicular direction for fan spread
        const perpAngle = rayAngle + Math.PI / 2;

        const fanSpread = 0.4; // radians of total fan spread
        const rayLength = 80 + 40 * Math.sin(ray.dispersePhase);

        for (let c = 0; c < RAINBOW.length; c++) {
          const t = (c / (RAINBOW.length - 1)) - 0.5; // -0.5 to 0.5
          const angle = perpAngle + t * fanSpread;
          const endRX = result.cx + Math.cos(angle) * rayLength;
          const endRY = result.cy + Math.sin(angle) * rayLength;

          const holdAlpha = Math.min(ray.holdTime / 30, 1) * alpha;

          ctx.beginPath();
          ctx.moveTo(result.cx, result.cy);
          ctx.lineTo(endRX, endRY);
          ctx.strokeStyle = RAINBOW[c] + (holdAlpha * 0.7) + ')';
          ctx.lineWidth = 2.5;
          ctx.stroke();

          // Small glow at the end of each rainbow ray
          const glowR = 8 + 4 * Math.sin(ray.dispersePhase + c);
          ctx.beginPath();
          ctx.arc(endRX, endRY, glowR, 0, Math.PI * 2);
          ctx.fillStyle = RAINBOW[c] + (holdAlpha * 0.3) + ')';
          ctx.fill();
        }

        // Show lumen generation text
        if (ray.holdTime % 30 === 0 && ray.holdTime > 0) {
          const lumensThisBurst = Math.floor(ray.lumensGenerated);
          if (lumensThisBurst > 0) {
            halos.push({
              type: 'combo-text',
              x: result.cx + (Math.random() - 0.5) * 40,
              y: result.cy - 30,
              text: '+' + formatNumber(lumensThisBurst),
              opacity: 0.9,
              life: 1.0,
              decay: 0.025,
              delay: 0,
              maxRadius: 0,
            });
            ray.lumensGenerated = 0; // reset for next burst display
          }
        }
      }

      // Draw a subtle "energy remaining" indicator — ray dims from end
      if (ray.life < 0.5) {
        const fadeAlpha = ray.life / 0.5;
        ctx.beginPath();
        ctx.moveTo(ray.startX, ray.startY);
        ctx.lineTo(ray.endX, ray.endY);
        ctx.strokeStyle = `rgba(255, 255, 255, ${(1 - fadeAlpha) * 0.3})`;
        ctx.lineWidth = baseWidth * 0.5;
        ctx.setLineDash([4, 8]);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      ctx.restore();
    }
  }

  // --- Prism interaction handlers ---
  function startPrismHold(x, y) {
    prismHolding = true;
    prismHoldX = x;
    prismHoldY = y;
  }

  function movePrismHold(x, y) {
    if (!prismHolding) return;
    prismHoldX = x;
    prismHoldY = y;
  }

  function endPrismHold() {
    prismHolding = false;
    // Reset hold time on all rays
    for (const ray of prismRays) {
      ray.active = false;
      ray.holdTime = 0;
    }
  }

  // --- Passive income tick ---
  function passiveTick() {
    if (state.victoryReached || state.sunPurchased) return;
    if (state.lumensPerSecond > 0) {
      const gain = state.lumensPerSecond / 10; // called 10x per sec
      state.lumens += gain;
      state.totalLumens += gain;
      checkMilestones();
      updateUI();
    }
  }

  // --- Save / Load ---
  function save() {
    const data = {
      lumens: state.lumens,
      totalLumens: state.totalLumens,
      clickPower: state.clickPower,
      upgrades: state.upgrades,
      victoryReached: state.victoryReached,
      sunPurchased: state.sunPurchased,
    };
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    } catch (_) {
      // silently fail if storage unavailable
    }
  }

  function load() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return;
      const data = JSON.parse(raw);
      state.lumens = data.lumens || 0;
      state.totalLumens = data.totalLumens || 0;
      state.clickPower = data.clickPower || 1;
      state.upgrades = data.upgrades || {};
      state.victoryReached = data.victoryReached || false;
      state.sunPurchased = data.sunPurchased || false;

      recalcPassive();
      checkMilestones();
      updateUI();
      renderUpgrades();

      if (state.victoryReached) {
        victoryScreen.classList.remove('hidden');
      } else if (state.sunPurchased) {
        upgradeToggle.classList.add('hidden');
        showSwitch();
      }
    } catch (_) {
      // corrupted save, ignore
    }
  }

  // --- Format numbers ---
  function formatNumber(n) {
    if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
    if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
    return Math.floor(n).toString();
  }

  // --- Game loop ---
  function gameLoop() {
    updateHalos();
    updateLightBursts();
    updatePrismRays();
    checkBurstSpawn();
    checkRaySpawn();
    drawHalos();
    drawPrismRays();
    drawLightBursts();
    requestAnimationFrame(gameLoop);
  }

  // --- Init ---
  load();
  updateUI();
  gameLoop();
  setInterval(passiveTick, 100);
  setInterval(save, 5000); // auto-save every 5s
  setInterval(function () {
    if (upgradePanel.classList.contains('open')) {
      renderUpgrades();
    }
  }, 500);

})();
