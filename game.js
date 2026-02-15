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
      id: 'candle',
      name: 'Bougie',
      desc: '+1 lumen/sec',
      baseCost: 50,
      costMultiplier: 1.4,
      type: 'passive',
      value: 1,
      maxCount: 50,
      unlockAt: 0,
    },
    {
      id: 'click1',
      name: 'Clic renforcé',
      desc: '+1 lumen par clic',
      baseCost: 200,
      costMultiplier: 1.8,
      type: 'click',
      value: 1,
      maxCount: 25,
      unlockAt: 100,
    },
    {
      id: 'oil_lamp',
      name: 'Lampe à huile',
      desc: '+5 lumens/sec',
      baseCost: 500,
      costMultiplier: 1.5,
      type: 'passive',
      value: 5,
      maxCount: 30,
      unlockAt: 300,
    },
    {
      id: 'click2',
      name: 'Clic puissant',
      desc: '+5 lumens par clic',
      baseCost: 1500,
      costMultiplier: 2.0,
      type: 'click',
      value: 5,
      maxCount: 20,
      unlockAt: 800,
    },
    {
      id: 'bulb',
      name: 'Ampoule',
      desc: '+25 lumens/sec',
      baseCost: 5000,
      costMultiplier: 1.5,
      type: 'passive',
      value: 25,
      maxCount: 25,
      unlockAt: 3000,
    },
    {
      id: 'neon',
      name: 'Néon',
      desc: '+100 lumens/sec',
      baseCost: 15000,
      costMultiplier: 1.6,
      type: 'passive',
      value: 100,
      maxCount: 20,
      unlockAt: 10000,
    },
    {
      id: 'projector',
      name: 'Projecteur',
      desc: '+500 lumens/sec',
      baseCost: 50000,
      costMultiplier: 1.7,
      type: 'passive',
      value: 500,
      maxCount: 15,
      unlockAt: 35000,
    },
    {
      id: 'sun',
      name: 'Soleil',
      desc: 'La lumière totale',
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
      }
    }
  }

  // --- Click handler ---
  function handleClick(e) {
    if (state.victoryReached) return;

    // Don't count clicks on UI elements
    if (e.target.closest('#upgrade-panel') || e.target.closest('#upgrade-toggle')) return;

    const x = e.clientX || (e.touches && e.touches[0].clientX);
    const y = e.clientY || (e.touches && e.touches[0].clientY);

    if (x === undefined || y === undefined) return;

    state.lumens += state.clickPower;
    state.totalLumens += state.clickPower;

    addHalo(x, y);
    checkMilestones();
    updateUI();
  }

  gameArea.addEventListener('click', handleClick);
  gameArea.addEventListener('touchstart', function (e) {
    if (e.target.closest('#upgrade-panel') || e.target.closest('#upgrade-toggle')) return;
    e.preventDefault();
    const touch = e.touches[0];
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

    recalcPassive();
    renderUpgrades();
    updateUI();
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
    upgradeList.innerHTML = '';
    for (const up of UPGRADES) {
      if (state.totalLumens < up.unlockAt && getUpgradeCount(up.id) === 0) continue;

      const count = getUpgradeCount(up.id);
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
        <div class="upgrade-cost">${isMaxed ? 'MAX' : formatNumber(cost) + ' lumens'}</div>
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
    if (!upgradeUnlocked && state.totalLumens >= 25) {
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
    updateUI();
    renderUpgrades();
  });

  // --- Upgrade panel toggle ---
  upgradeToggle.addEventListener('click', function (e) {
    e.stopPropagation();
    upgradePanel.classList.toggle('open');
    renderUpgrades();
  });

  upgradeClose.addEventListener('click', function (e) {
    e.stopPropagation();
    upgradePanel.classList.remove('open');
  });

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
    drawHalos();
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
