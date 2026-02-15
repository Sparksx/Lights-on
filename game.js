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
    if (state.victoryReached) return;
    isRubbing = true;
    lastRubX = x;
    lastRubY = y;
    rubDistance = 0;
  }

  function moveRub(x, y) {
    if (!isRubbing || state.victoryReached) return;
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
    if (e.target.closest('#upgrade-panel') || e.target.closest('#upgrade-toggle')) return;
    startRub(e.clientX, e.clientY);
  });
  gameArea.addEventListener('mousemove', function (e) {
    if (e.target.closest('#upgrade-panel')) return;
    moveRub(e.clientX, e.clientY);
  });
  gameArea.addEventListener('mouseup', endRub);
  gameArea.addEventListener('mouseleave', endRub);

  gameArea.addEventListener('touchmove', function (e) {
    if (e.target.closest('#upgrade-panel')) return;
    e.preventDefault();
    const touch = e.touches[0];
    moveRub(touch.clientX, touch.clientY);
  }, { passive: false });

  gameArea.addEventListener('touchend', endRub);
  gameArea.addEventListener('touchcancel', endRub);

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
    if (state.victoryReached) return;

    // Don't count clicks on UI elements
    if (e.target.closest('#upgrade-panel') || e.target.closest('#upgrade-toggle')) return;

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
    if (e.target.closest('#upgrade-panel') || e.target.closest('#upgrade-toggle')) return;
    e.preventDefault();
    const touch = e.touches[0];
    startRub(touch.clientX, touch.clientY);
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
      triggerVictory();
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
    upgradeUnlocked = false;
    upgradeToggle.classList.add('hidden');
    upgradePanel.classList.remove('open');
    victoryScreen.classList.add('hidden');
    halos.length = 0;
    lightBursts.length = 0;
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
    upgradeUnlocked = false;
    upgradeToggle.classList.add('hidden');
    upgradePanel.classList.remove('open');
    victoryScreen.classList.add('hidden');
    halos.length = 0;
    lightBursts.length = 0;
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

    lightBursts.push({
      x, y,
      radius: 20,
      bonus: bonus,
      life: 1.0,
      decay: 0.002, // ~8 seconds to disappear
      pulse: 0,
    });
  }

  function checkBurstSpawn() {
    if (state.victoryReached) return;
    if (getUpgradeCount('firefly') === 0) return;
    if (Date.now() >= nextBurstTime && lightBursts.length < 3) {
      spawnLightBurst();
      nextBurstTime = Date.now() + 10000 + Math.random() * 15000;
    }
  }

  function updateLightBursts() {
    for (let i = lightBursts.length - 1; i >= 0; i--) {
      const b = lightBursts[i];
      b.life -= b.decay;
      b.pulse += 0.05;
      if (b.life <= 0) {
        lightBursts.splice(i, 1);
      }
    }
  }

  function drawLightBursts() {
    for (const b of lightBursts) {
      const alpha = Math.min(b.life * 2, 1); // fade in then out
      const pulseScale = 1 + 0.15 * Math.sin(b.pulse);
      const r = b.radius * pulseScale;

      // Outer glow
      const gradient = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, r * 2.5);
      gradient.addColorStop(0, `rgba(255, 255, 255, ${alpha * 0.4})`);
      gradient.addColorStop(0.4, `rgba(255, 255, 255, ${alpha * 0.15})`);
      gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
      ctx.beginPath();
      ctx.arc(b.x, b.y, r * 2.5, 0, Math.PI * 2);
      ctx.fillStyle = gradient;
      ctx.fill();

      // Core
      const core = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, r);
      core.addColorStop(0, `rgba(255, 255, 255, ${alpha * 0.9})`);
      core.addColorStop(1, `rgba(255, 255, 255, ${alpha * 0.2})`);
      ctx.beginPath();
      ctx.arc(b.x, b.y, r, 0, Math.PI * 2);
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

  // --- Passive income tick ---
  function passiveTick() {
    if (state.victoryReached) return;
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

      recalcPassive();
      checkMilestones();
      updateUI();
      renderUpgrades();

      if (state.victoryReached) {
        victoryScreen.classList.remove('hidden');
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
    checkBurstSpawn();
    drawHalos();
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
