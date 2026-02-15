// === LIGHT — Clicker Game (On / Off modes) ===

(function () {
  'use strict';

  // --- Game Mode ---
  // 'on' = classic (dark→light), 'off' = inverted (light→dark)
  let gameMode = null; // set by landing page
  let gameStarted = false;

  // --- Mode Selection Landing Page ---
  const modeSelect = document.getElementById('mode-select');
  const modeOn = document.getElementById('mode-on');
  const modeOff = document.getElementById('mode-off');

  function startGame(mode) {
    if (gameStarted) return;
    gameStarted = true;
    gameMode = mode;

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
      victoryText.textContent = 'Vous avez éteint la lumière.';
      switchHint.textContent = 'Éteignez la lumière';
    } else {
      victoryTitle.textContent = 'LIGHTS ON';
      victoryText.textContent = 'Vous avez ramené la lumière.';
      switchHint.textContent = 'Allumez la lumière';
    }

    // Save chosen mode
    try { localStorage.setItem('light-game-mode', mode); } catch(_) {}

    // After animation, reveal the game
    setTimeout(function () {
      modeSelect.style.display = 'none';
      document.getElementById('game-area').classList.remove('hidden');
      resizeCanvas();
      initGame();
    }, 700);
  }

  modeOn.addEventListener('click', function () { startGame('on'); });
  modeOff.addEventListener('click', function () { startGame('off'); });

  // Check for saved game — skip landing if save exists
  (function checkSavedGame() {
    try {
      var savedMode = localStorage.getItem('light-game-mode');
      // Also check legacy save
      var hasOnSave = localStorage.getItem('lights-on-save');
      var hasOffSave = localStorage.getItem('lights-off-save');
      if (savedMode === 'off' && hasOffSave) {
        startGame('off');
      } else if (savedMode === 'on' && hasOnSave) {
        startGame('on');
      } else if (!savedMode && hasOnSave) {
        // Legacy save from before mode selection
        startGame('on');
      }
    } catch(_) {}
  })();

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
  const VICTORY_LUMENS = 1000000000000;
  function getSaveKey() {
    return gameMode === 'off' ? 'lights-off-save' : 'lights-on-save';
  }

  // --- Color helpers for mode-aware rendering ---
  function rgb(r, g, b) {
    if (gameMode === 'off') {
      return (255 - r) + ', ' + (255 - g) + ', ' + (255 - b);
    }
    return r + ', ' + g + ', ' + b;
  }

  function rgba(r, g, b, a) {
    return 'rgba(' + rgb(r, g, b) + ', ' + a + ')';
  }

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
      id: 'supernova',
      name: 'Supernova',
      desc: 'L\'étoile meurt dans un cri de lumière',
      baseCost: 300000,
      costMultiplier: 1.65,
      type: 'passive',
      value: 2500,
      maxCount: 10,
      unlockAt: 180000,
    },
    {
      id: 'pulsar',
      name: 'Pulsar',
      desc: 'Un battement de cœur dans le vide',
      baseCost: 800000,
      costMultiplier: 2.0,
      type: 'click',
      value: 35,
      maxCount: 12,
      unlockAt: 450000,
    },
    {
      id: 'nebula',
      name: 'Nébuleuse',
      desc: 'Le berceau des soleils à naître',
      baseCost: 2000000,
      costMultiplier: 1.6,
      type: 'passive',
      value: 8000,
      maxCount: 10,
      unlockAt: 1200000,
    },
    {
      id: 'comet',
      name: 'Comète',
      desc: 'Une traînée de glace et de feu',
      baseCost: 5000000,
      costMultiplier: 1.8,
      type: 'burst',
      value: 2,
      maxCount: 20,
      unlockAt: 3000000,
    },
    {
      id: 'quasar',
      name: 'Quasar',
      desc: 'Plus brillant qu\'un milliard de soleils',
      baseCost: 15000000,
      costMultiplier: 1.65,
      type: 'passive',
      value: 30000,
      maxCount: 8,
      unlockAt: 8000000,
    },
    {
      id: 'plasma',
      name: 'Plasma',
      desc: 'Le quatrième état de la matière',
      baseCost: 40000000,
      costMultiplier: 2.0,
      type: 'click',
      value: 120,
      maxCount: 10,
      unlockAt: 20000000,
    },
    {
      id: 'constellation',
      name: 'Constellation',
      desc: 'Des histoires écrites dans le ciel',
      baseCost: 100000000,
      costMultiplier: 1.6,
      type: 'passive',
      value: 100000,
      maxCount: 8,
      unlockAt: 55000000,
    },
    {
      id: 'galaxy',
      name: 'Galaxie',
      desc: 'Cent milliards d\'étoiles dansent',
      baseCost: 300000000,
      costMultiplier: 1.65,
      type: 'passive',
      value: 350000,
      maxCount: 6,
      unlockAt: 150000000,
    },
    {
      id: 'whitehole',
      name: 'Trou blanc',
      desc: 'Ce qui a été avalé est rendu',
      baseCost: 1000000000,
      costMultiplier: 1.7,
      type: 'passive',
      value: 1200000,
      maxCount: 6,
      unlockAt: 500000000,
    },
    {
      id: 'darkmatter',
      name: 'Matière noire',
      desc: 'Invisible, elle sculpte l\'univers',
      baseCost: 3000000000,
      costMultiplier: 1.7,
      type: 'passive',
      value: 4000000,
      maxCount: 5,
      unlockAt: 1500000000,
    },
    {
      id: 'bigbang',
      name: 'Big Bang',
      desc: 'Que la lumière soit',
      baseCost: 10000000000,
      costMultiplier: 1.75,
      type: 'passive',
      value: 15000000,
      maxCount: 5,
      unlockAt: 5000000000,
    },
    {
      id: 'cosmiclight',
      name: 'Lumière cosmique',
      desc: 'L\'écho du premier instant',
      baseCost: 30000000000,
      costMultiplier: 1.8,
      type: 'passive',
      value: 50000000,
      maxCount: 4,
      unlockAt: 15000000000,
    },
    {
      id: 'multiverse',
      name: 'Multivers',
      desc: 'Chaque choix, un nouveau soleil',
      baseCost: 100000000000,
      costMultiplier: 1.85,
      type: 'passive',
      value: 200000000,
      maxCount: 3,
      unlockAt: 50000000000,
    },
    {
      id: 'eternity',
      name: 'Éternité',
      desc: 'Le temps n\'est plus qu\'une lueur',
      baseCost: 400000000000,
      costMultiplier: 1.9,
      type: 'passive',
      value: 800000000,
      maxCount: 3,
      unlockAt: 180000000000,
    },
    {
      id: 'sun',
      name: 'Soleil',
      desc: '?',
      baseCost: 1000000000000,
      costMultiplier: 1,
      type: 'victory',
      value: 0,
      maxCount: 1,
      unlockAt: 500000000000,
    },
  ];

  // --- Shadow-themed names/descriptions for Off mode ---
  // Maps upgrade id → { name, desc } for the "Lights Off" universe
  // Unique progression: entropy, silence, void — NOT dark mirrors of light concepts
  const SHADOW_THEME = {
    spark:         { name: 'Murmure',           desc: 'Le premier son qui s\'éteint' },
    firefly:       { name: 'Éphémère',          desc: 'N\'existe que pour disparaître' },
    candle:        { name: 'Suie',              desc: 'Ce qui reste quand la flamme meurt' },
    prism:         { name: 'Onyx',              desc: 'La pierre qui avale la lumière' },
    lantern:       { name: 'Braise',            desc: 'Le dernier soupir du feu' },
    lightning:     { name: 'Fissure',           desc: 'La réalité se fend' },
    lighthouse:    { name: 'Sirène',            desc: 'Attire vers les profondeurs' },
    aurora:        { name: 'Crépuscule',        desc: 'Le ciel se referme' },
    star:          { name: 'Cendre',            desc: 'Poussière de ce qui fut' },
    supernova:     { name: 'Singularité',       desc: 'Le point de non-retour' },
    pulsar:        { name: 'Vortex',            desc: 'Un tourbillon sans fond' },
    nebula:        { name: 'Miasme',            desc: 'Un brouillard qui dévore' },
    comet:         { name: 'Spectre',           desc: 'L\'écho d\'une lumière morte' },
    quasar:        { name: 'Abîme',             desc: 'Regarde trop longtemps, il te regarde' },
    plasma:        { name: 'Entropie',          desc: 'Le désordre absolu' },
    constellation: { name: 'Oubli',             desc: 'Les souvenirs se dissolvent' },
    galaxy:        { name: 'Maelström',         desc: 'Le tourbillon final' },
    whitehole:     { name: 'Horizon',           desc: 'Au-delà, rien ne revient' },
    darkmatter:    { name: 'Néant',             desc: 'L\'absence même d\'absence' },
    bigbang:       { name: 'Big Crunch',        desc: 'L\'univers se replie sur lui-même' },
    cosmiclight:   { name: 'Silence cosmique',  desc: 'Le dernier écho s\'éteint' },
    multiverse:    { name: 'Dissolution',       desc: 'La matière retourne au vide' },
    eternity:      { name: 'Extinction',        desc: 'Le temps cesse de couler' },
    sun:           { name: 'Éclipse',           desc: '?' },
  };

  // Helper to get display name/desc based on current mode
  function getUpgradeName(up) {
    if (gameMode === 'off' && SHADOW_THEME[up.id]) return SHADOW_THEME[up.id].name;
    return up.name;
  }
  function getUpgradeDesc(up) {
    if (gameMode === 'off' && SHADOW_THEME[up.id]) return SHADOW_THEME[up.id].desc;
    return up.desc;
  }

  // Unit name based on mode
  function unitName() {
    return gameMode === 'off' ? 'ob' : 'lm';
  }

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

  // --- Background stars system (Étoile upgrade #9) ---
  const bgStars = [];
  let lastStarCount = 0;

  function regenerateStars() {
    const starCount = getUpgradeCount('star');
    if (starCount === lastStarCount && bgStars.length > 0) return;
    lastStarCount = starCount;
    bgStars.length = 0;
    // Each star level adds 8 stars (max 10 levels = 80 stars)
    const total = starCount * 8;
    for (let i = 0; i < total; i++) {
      bgStars.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        size: 0.5 + Math.random() * 1.5,
        baseAlpha: 0.15 + Math.random() * 0.4,
        twinkleSpeed: 0.01 + Math.random() * 0.03,
        twinklePhase: Math.random() * Math.PI * 2,
        constellationId: -1, // will be set by constellation system
        constellationIdx: -1,
      });
    }
  }

  function updateStars() {
    for (const s of bgStars) {
      s.twinklePhase += s.twinkleSpeed;
    }
  }

  function drawStars() {
    const starCount = getUpgradeCount('star');
    if (starCount === 0) return;

    if (gameMode === 'off') {
      // OFF MODE: Cendres — dark ash particles drifting, eerie
      for (const s of bgStars) {
        const twinkle = 0.5 + 0.5 * Math.sin(s.twinklePhase);
        const alpha = s.baseAlpha * twinkle * 0.6;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.size * 0.8, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(0, 0, 0, ' + alpha + ')';
        ctx.fill();
        // Tiny dark aura
        if (s.size > 1) {
          const aura = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, s.size * 2.5);
          aura.addColorStop(0, 'rgba(0, 0, 0, ' + (alpha * 0.2) + ')');
          aura.addColorStop(1, 'rgba(0, 0, 0, 0)');
          ctx.beginPath();
          ctx.arc(s.x, s.y, s.size * 2.5, 0, Math.PI * 2);
          ctx.fillStyle = aura;
          ctx.fill();
        }
      }
    } else {
      // ON MODE: Bright twinkling stars
      for (const s of bgStars) {
        const twinkle = 0.5 + 0.5 * Math.sin(s.twinklePhase);
        const alpha = s.baseAlpha * twinkle;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
        ctx.fillStyle = rgba(255, 255, 255, alpha);
        ctx.fill();
      }
    }
  }

  // --- Constellation system (upgrade #16) ---
  // Known constellation patterns (normalized 0-1 coordinates)
  const CONSTELLATION_TEMPLATES = [
    { name: 'Grande Ourse', stars: [{x:0.0,y:0.4},{x:0.15,y:0.25},{x:0.3,y:0.2},{x:0.45,y:0.25},{x:0.55,y:0.4},{x:0.7,y:0.55},{x:0.85,y:0.5}], edges: [[0,1],[1,2],[2,3],[3,4],[4,5],[5,6],[6,3]] },
    { name: 'Orion', stars: [{x:0.3,y:0.0},{x:0.7,y:0.05},{x:0.2,y:0.35},{x:0.5,y:0.4},{x:0.8,y:0.35},{x:0.5,y:0.5},{x:0.35,y:0.7},{x:0.5,y:0.65},{x:0.65,y:0.7},{x:0.25,y:1.0},{x:0.75,y:1.0}], edges: [[0,2],[1,4],[2,3],[3,4],[2,5],[4,5],[5,6],[5,8],[6,7],[7,8],[6,9],[8,10]] },
    { name: 'Cassiopée', stars: [{x:0.0,y:0.6},{x:0.25,y:0.2},{x:0.5,y:0.5},{x:0.75,y:0.15},{x:1.0,y:0.55}], edges: [[0,1],[1,2],[2,3],[3,4]] },
    { name: 'Cygne', stars: [{x:0.5,y:0.0},{x:0.5,y:0.3},{x:0.5,y:0.6},{x:0.5,y:1.0},{x:0.15,y:0.45},{x:0.85,y:0.45}], edges: [[0,1],[1,2],[2,3],[4,2],[2,5]] },
    { name: 'Lion', stars: [{x:0.3,y:0.0},{x:0.15,y:0.2},{x:0.0,y:0.45},{x:0.2,y:0.55},{x:0.35,y:0.35},{x:0.5,y:0.25},{x:0.85,y:0.3},{x:1.0,y:0.55},{x:0.7,y:0.6}], edges: [[0,1],[1,2],[2,3],[3,4],[4,0],[0,5],[5,6],[6,7],[7,8],[8,6]] },
    { name: 'Scorpion', stars: [{x:0.2,y:0.0},{x:0.25,y:0.15},{x:0.3,y:0.3},{x:0.4,y:0.45},{x:0.5,y:0.55},{x:0.6,y:0.65},{x:0.7,y:0.75},{x:0.8,y:0.85},{x:0.9,y:0.9},{x:1.0,y:0.85}], edges: [[0,1],[1,2],[2,3],[3,4],[4,5],[5,6],[6,7],[7,8],[8,9]] },
    { name: 'Lyre', stars: [{x:0.5,y:0.0},{x:0.3,y:0.4},{x:0.7,y:0.4},{x:0.25,y:0.8},{x:0.75,y:0.8}], edges: [[0,1],[0,2],[1,2],[1,3],[2,4],[3,4]] },
    { name: 'Gémeaux', stars: [{x:0.3,y:0.0},{x:0.7,y:0.0},{x:0.25,y:0.3},{x:0.75,y:0.3},{x:0.2,y:0.6},{x:0.8,y:0.6},{x:0.3,y:0.9},{x:0.7,y:0.9}], edges: [[0,1],[0,2],[1,3],[2,4],[3,5],[4,6],[5,7],[2,3]] },
  ];

  const activeConstellations = [];
  let nextConstellationTime = Date.now() + 5000;
  let constellationDragActive = false;
  let constellationDragPath = []; // {x, y} points the user has dragged through
  let constellationTracedEdges = []; // edges already validated in current drag

  function spawnConstellation() {
    const constellationCount = getUpgradeCount('constellation');
    if (constellationCount === 0) return;
    if (activeConstellations.length >= Math.min(2 + Math.floor(constellationCount / 2), 5)) return;

    // Pick a random template not already active
    const usedNames = activeConstellations.map(function(c) { return c.name; });
    const available = CONSTELLATION_TEMPLATES.filter(function(t) { return usedNames.indexOf(t.name) === -1; });
    if (available.length === 0) return;

    const template = available[Math.floor(Math.random() * available.length)];

    // Place in a random area of the screen
    const padding = 100;
    const size = 120 + constellationCount * 15; // grows with upgrades
    const areaX = padding + Math.random() * (canvas.width - padding * 2 - size);
    const areaY = padding + Math.random() * (canvas.height - padding * 2 - size);

    const placedStars = template.stars.map(function(s) {
      return {
        x: areaX + s.x * size,
        y: areaY + s.y * size,
        traced: false,
      };
    });

    activeConstellations.push({
      name: template.name,
      stars: placedStars,
      edges: template.edges.map(function(e) { return { from: e[0], to: e[1], traced: false }; }),
      life: 1.0,
      completed: false,
      completedTime: 0,
      sparklePhase: 0,
    });
  }

  function checkConstellationSpawn() {
    if (getUpgradeCount('constellation') === 0) return;
    if (getUpgradeCount('star') === 0) return; // need stars first
    if (Date.now() < nextConstellationTime) return;
    spawnConstellation();
    const constellationCount = getUpgradeCount('constellation');
    const interval = Math.max(8000, 20000 - constellationCount * 1500);
    nextConstellationTime = Date.now() + interval + Math.random() * interval * 0.5;
  }

  function updateConstellations() {
    for (let i = activeConstellations.length - 1; i >= 0; i--) {
      const c = activeConstellations[i];
      if (c.completed) {
        c.completedTime++;
        c.sparklePhase += 0.1;
        c.life -= 0.008; // fade out over ~2 seconds
        if (c.life <= 0) {
          activeConstellations.splice(i, 1);
        }
      }
    }
  }

  function drawConstellations() {
    if (getUpgradeCount('constellation') === 0) return;

    const isOff = gameMode === 'off';

    for (const c of activeConstellations) {
      const alpha = Math.min(c.life, 1.0);
      if (alpha <= 0) continue;

      // Draw edges
      for (const edge of c.edges) {
        const s1 = c.stars[edge.from];
        const s2 = c.stars[edge.to];
        ctx.beginPath();
        ctx.moveTo(s1.x, s1.y);
        ctx.lineTo(s2.x, s2.y);
        if (isOff) {
          // OFF MODE: Oubli — dark fading lines, like memories dissolving
          if (edge.traced || c.completed) {
            ctx.strokeStyle = 'rgba(0, 0, 0, ' + (alpha * 0.5) + ')';
            ctx.lineWidth = 1.5;
            ctx.setLineDash([3, 3]); // dashed = fragmented memories
          } else {
            ctx.strokeStyle = 'rgba(0, 0, 0, ' + (alpha * 0.06) + ')';
            ctx.lineWidth = 0.5;
            ctx.setLineDash([2, 6]);
          }
        } else {
          if (edge.traced || c.completed) {
            ctx.strokeStyle = rgba(200, 220, 255, alpha * 0.6);
            ctx.lineWidth = 1.5;
          } else {
            ctx.strokeStyle = rgba(255, 255, 255, alpha * 0.08);
            ctx.lineWidth = 0.5;
          }
        }
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // Draw stars/nodes
      for (let si = 0; si < c.stars.length; si++) {
        const s = c.stars[si];

        if (isOff) {
          // OFF MODE: Dark nodes — like holes in the fabric
          const starAlpha = (s.traced || c.completed) ? alpha * 0.7 : alpha * 0.25;
          const starSize = (s.traced || c.completed) ? 2.5 : 1.5;

          // Dark dissolution effect when completed
          if (c.completed) {
            const dissolve = 0.5 + 0.5 * Math.sin(c.sparklePhase + si * 1.3);
            const dissolveR = starSize + dissolve * 5;
            const dGrad = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, dissolveR);
            dGrad.addColorStop(0, 'rgba(0, 0, 0, ' + (alpha * dissolve * 0.3) + ')');
            dGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
            ctx.beginPath();
            ctx.arc(s.x, s.y, dissolveR, 0, Math.PI * 2);
            ctx.fillStyle = dGrad;
            ctx.fill();
          }

          ctx.beginPath();
          ctx.arc(s.x, s.y, starSize, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(0, 0, 0, ' + starAlpha + ')';
          ctx.fill();
        } else {
          const starAlpha = (s.traced || c.completed) ? alpha * 0.9 : alpha * 0.4;
          const starSize = (s.traced || c.completed) ? 2.5 : 1.8;

          if (c.completed) {
            const sparkle = 0.5 + 0.5 * Math.sin(c.sparklePhase + si * 1.3);
            ctx.beginPath();
            ctx.arc(s.x, s.y, starSize + sparkle * 4, 0, Math.PI * 2);
            ctx.fillStyle = rgba(200, 220, 255, alpha * sparkle * 0.3);
            ctx.fill();
          }

          ctx.beginPath();
          ctx.arc(s.x, s.y, starSize, 0, Math.PI * 2);
          ctx.fillStyle = rgba(255, 255, 255, starAlpha);
          ctx.fill();
        }
      }

      // Show name when completed
      if (c.completed) {
        const ccx = c.stars.reduce(function(sum, s) { return sum + s.x; }, 0) / c.stars.length;
        const ccy = c.stars.reduce(function(sum, s) { return sum + s.y; }, 0) / c.stars.length;
        ctx.save();
        ctx.font = '12px "Courier New", monospace';
        ctx.textAlign = 'center';
        if (isOff) {
          // OFF MODE: Name fading away with strikethrough effect
          ctx.fillStyle = 'rgba(0, 0, 0, ' + (alpha * 0.5) + ')';
          ctx.fillText(c.name, ccx, ccy - 15);
          // Strikethrough line through the name
          const textWidth = ctx.measureText(c.name).width;
          ctx.beginPath();
          ctx.moveTo(ccx - textWidth / 2, ccy - 12);
          ctx.lineTo(ccx + textWidth / 2, ccy - 12);
          ctx.strokeStyle = 'rgba(0, 0, 0, ' + (alpha * 0.3) + ')';
          ctx.lineWidth = 1;
          ctx.stroke();
        } else {
          ctx.fillStyle = rgba(200, 220, 255, alpha * 0.7);
          ctx.fillText(c.name, ccx, ccy - 15);
        }
        ctx.restore();
      }
    }

    // Draw current drag path
    if (constellationDragActive && constellationDragPath.length > 1) {
      ctx.beginPath();
      ctx.moveTo(constellationDragPath[0].x, constellationDragPath[0].y);
      for (let i = 1; i < constellationDragPath.length; i++) {
        ctx.lineTo(constellationDragPath[i].x, constellationDragPath[i].y);
      }
      if (isOff) {
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.25)';
      } else {
        ctx.strokeStyle = rgba(200, 220, 255, 0.3);
      }
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }

  function startConstellationDrag(x, y) {
    if (getUpgradeCount('constellation') === 0) return;
    // Check if starting near a constellation star
    for (const c of activeConstellations) {
      if (c.completed) continue;
      for (let si = 0; si < c.stars.length; si++) {
        const s = c.stars[si];
        const dx = x - s.x;
        const dy = y - s.y;
        if (Math.sqrt(dx * dx + dy * dy) < 25) {
          constellationDragActive = true;
          constellationDragPath = [{ x: x, y: y, starIdx: si, constellation: c }];
          constellationTracedEdges = [];
          s.traced = true;
          return;
        }
      }
    }
  }

  function moveConstellationDrag(x, y) {
    if (!constellationDragActive || constellationDragPath.length === 0) return;
    constellationDragPath.push({ x: x, y: y });

    const firstPoint = constellationDragPath[0];
    const c = firstPoint.constellation;
    if (c.completed) { endConstellationDrag(); return; }

    // Check if we're near a star in the same constellation
    for (let si = 0; si < c.stars.length; si++) {
      const s = c.stars[si];
      const dx = x - s.x;
      const dy = y - s.y;
      if (Math.sqrt(dx * dx + dy * dy) < 25) {
        s.traced = true;

        // Check if this traces an edge from any previously traced star
        for (const edge of c.edges) {
          if (edge.traced) continue;
          // Find if this edge connects the new star to any traced star
          const otherIdx = (edge.from === si) ? edge.to : ((edge.to === si) ? edge.from : -1);
          if (otherIdx >= 0 && c.stars[otherIdx].traced) {
            edge.traced = true;
          }
        }

        // Check completion: are all edges traced?
        const allTraced = c.edges.every(function(e) { return e.traced; });
        if (allTraced) {
          c.completed = true;
          // Reward lumens
          const constellationCount = getUpgradeCount('constellation');
          const bonus = Math.max(100, Math.floor(state.totalLumens * (0.01 + constellationCount * 0.005)));
          state.lumens += bonus;
          state.totalLumens += bonus;
          checkMilestones();
          updateUI();

          // Visual reward
          const cx = c.stars.reduce(function(sum, s) { return sum + s.x; }, 0) / c.stars.length;
          const cy = c.stars.reduce(function(sum, s) { return sum + s.y; }, 0) / c.stars.length;
          if (gameMode === 'off') {
            // OFF MODE: Void implodes where the memory was erased
            halos.push({
              type: 'void-implode',
              x: cx, y: cy,
              maxRadius: 90,
              opacity: 0.5,
              life: 1.0,
              decay: 0.01,
              delay: 0,
            });
          } else {
            halos.push({
              type: 'glow',
              x: cx, y: cy,
              maxRadius: 80,
              opacity: 0.6,
              life: 1.0,
              decay: 0.01,
              delay: 0,
            });
          }
        }
      }
    }
  }

  function endConstellationDrag() {
    constellationDragActive = false;
    constellationDragPath = [];
    constellationTracedEdges = [];
  }

  // --- Pulsar spinning star system (upgrade #11) ---
  let mouseX = 0;
  let mouseY = 0;
  let pulsarAngle = 0;

  function updatePulsar() {
    const pulsarCount = getUpgradeCount('pulsar');
    if (pulsarCount === 0) return;
    // Very fast rotation: ~6 full spins per second (base) + more with upgrades
    pulsarAngle += 0.15 + pulsarCount * 0.02;
  }

  function drawPulsar() {
    const pulsarCount = getUpgradeCount('pulsar');
    if (pulsarCount === 0) return;

    const orbitCount = Math.min(1 + Math.floor(pulsarCount / 3), 4);
    const orbitRadius = 30 + pulsarCount * 2;

    if (gameMode === 'off') {
      // OFF MODE: Vortex — dark whirlpool that distorts space around cursor
      // Central dark void at cursor
      const coreR = 8 + pulsarCount;
      const coreGrad = ctx.createRadialGradient(mouseX, mouseY, 0, mouseX, mouseY, coreR);
      coreGrad.addColorStop(0, 'rgba(0, 0, 0, 0.7)');
      coreGrad.addColorStop(0.6, 'rgba(20, 0, 30, 0.3)');
      coreGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.beginPath();
      ctx.arc(mouseX, mouseY, coreR, 0, Math.PI * 2);
      ctx.fillStyle = coreGrad;
      ctx.fill();

      // Swirling dark arms (spiral pattern)
      ctx.save();
      ctx.translate(mouseX, mouseY);
      ctx.rotate(-pulsarAngle * 0.7); // reverse rotation for eerie feel
      const armCount = orbitCount + 2;
      for (let i = 0; i < armCount; i++) {
        const baseAngle = (i / armCount) * Math.PI * 2;
        ctx.beginPath();
        for (let t = 0; t < 1; t += 0.03) {
          const spiralR = coreR * 0.5 + t * (orbitRadius * 1.5);
          const spiralA = baseAngle + t * Math.PI * 2.5; // tighter spiral
          const sx = Math.cos(spiralA) * spiralR;
          const sy = Math.sin(spiralA) * spiralR;
          if (t === 0) ctx.moveTo(sx, sy);
          else ctx.lineTo(sx, sy);
        }
        const armAlpha = 0.3 + pulsarCount * 0.02;
        ctx.strokeStyle = 'rgba(0, 0, 0, ' + armAlpha + ')';
        ctx.lineWidth = 1.5 + pulsarCount * 0.15;
        ctx.stroke();
      }
      ctx.restore();

      // Orbiting shadow fragments (dark particles in the vortex)
      for (let i = 0; i < orbitCount; i++) {
        const angleOffset = (i / orbitCount) * Math.PI * 2;
        const angle = -pulsarAngle + angleOffset; // reverse direction

        // Dark trail
        const trailCount = 7;
        for (let t = trailCount; t >= 0; t--) {
          const trailAngle = angle + t * 0.15; // trail follows reverse
          const tx = mouseX + Math.cos(trailAngle) * orbitRadius;
          const ty = mouseY + Math.sin(trailAngle) * orbitRadius;
          const trailAlpha = (1 - t / trailCount) * 0.5;
          const trailSize = (1 - t / trailCount) * 3;

          ctx.beginPath();
          ctx.arc(tx, ty, trailSize, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(0, 0, 0, ' + trailAlpha + ')';
          ctx.fill();
        }

        const px = mouseX + Math.cos(angle) * orbitRadius;
        const py = mouseY + Math.sin(angle) * orbitRadius;

        // Dark fragment core
        ctx.beginPath();
        ctx.arc(px, py, 3, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        ctx.fill();

        // Dark purple glow
        const glow = ctx.createRadialGradient(px, py, 0, px, py, 10);
        glow.addColorStop(0, 'rgba(40, 0, 60, 0.4)');
        glow.addColorStop(1, 'rgba(20, 0, 30, 0)');
        ctx.beginPath();
        ctx.arc(px, py, 10, 0, Math.PI * 2);
        ctx.fillStyle = glow;
        ctx.fill();
      }

      // Outer distortion ring
      const distortR = orbitRadius * 1.8;
      ctx.beginPath();
      ctx.arc(mouseX, mouseY, distortR, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.06)';
      ctx.lineWidth = 1;
      ctx.stroke();

      return;
    }

    // ON MODE: Classic bright pulsar orbiting stars
    for (let i = 0; i < orbitCount; i++) {
      const angleOffset = (i / orbitCount) * Math.PI * 2;
      const angle = pulsarAngle + angleOffset;
      const px = mouseX + Math.cos(angle) * orbitRadius;
      const py = mouseY + Math.sin(angle) * orbitRadius;

      const trailCount = 5;
      for (let t = trailCount; t >= 0; t--) {
        const trailAngle = angle - t * 0.12;
        const tx = mouseX + Math.cos(trailAngle) * orbitRadius;
        const ty = mouseY + Math.sin(trailAngle) * orbitRadius;
        const trailAlpha = (1 - t / trailCount) * 0.6;
        const trailSize = (1 - t / trailCount) * 3;

        ctx.beginPath();
        ctx.arc(tx, ty, trailSize, 0, Math.PI * 2);
        ctx.fillStyle = rgba(200, 220, 255, trailAlpha);
        ctx.fill();
      }

      ctx.beginPath();
      ctx.arc(px, py, 3, 0, Math.PI * 2);
      ctx.fillStyle = rgba(255, 255, 255, 0.9);
      ctx.fill();

      const glow = ctx.createRadialGradient(px, py, 0, px, py, 12);
      glow.addColorStop(0, rgba(200, 220, 255, 0.4));
      glow.addColorStop(1, rgba(200, 220, 255, 0));
      ctx.beginPath();
      ctx.arc(px, py, 12, 0, Math.PI * 2);
      ctx.fillStyle = glow;
      ctx.fill();

      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(angle * 2);
      ctx.beginPath();
      const spikes = 4;
      const outerR = 5 + pulsarCount * 0.3;
      const innerR = 1.5;
      for (let s = 0; s < spikes * 2; s++) {
        const r = s % 2 === 0 ? outerR : innerR;
        const a = (s / (spikes * 2)) * Math.PI * 2;
        if (s === 0) ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
        else ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      ctx.closePath();
      ctx.fillStyle = rgba(255, 255, 255, 0.7);
      ctx.fill();
      ctx.restore();
    }
  }

  // --- Big Bang effect system (upgrade #20) ---
  let bigBangActive = false;
  let bigBangPhase = 0; // 0=idle, 1=implosion, 2=explosion
  let bigBangProgress = 0;
  let bigBangParticles = [];
  let nextBigBangTime = Date.now() + 30000 + Math.random() * 30000;

  function checkBigBangSpawn() {
    // In off mode, use black hole effect instead
    if (gameMode === 'off') return;
    const bbCount = getUpgradeCount('bigbang');
    if (bbCount === 0) return;
    if (bigBangActive) return;
    if (state.victoryReached || state.sunPurchased) return;
    if (Date.now() < nextBigBangTime) return;

    startBigBang();
    // Interval: 25-60 seconds, faster with more upgrades
    const interval = Math.max(15000, 40000 - bbCount * 3000);
    nextBigBangTime = Date.now() + interval + Math.random() * interval * 0.5;
  }

  function startBigBang() {
    bigBangActive = true;
    bigBangPhase = 1; // implosion
    bigBangProgress = 0;
    bigBangParticles = [];

    const cx = canvas.width / 2;
    const cy = canvas.height / 2;

    // Collect existing visible light (halos that are glows/persists)
    let hasLight = false;
    for (const h of halos) {
      if ((h.type === 'glow' || h.type === 'persist') && h.life > 0.1) {
        hasLight = true;
        bigBangParticles.push({
          x: h.x, y: h.y,
          originX: h.x, originY: h.y,
          targetX: cx, targetY: cy,
          size: 2 + Math.random() * 4,
          alpha: 0.5 + Math.random() * 0.5,
          phase: 0, // 0-1 for implosion, then 0-1 for explosion
          explosionAngle: Math.random() * Math.PI * 2,
          explosionDist: 100 + Math.random() * Math.max(canvas.width, canvas.height) * 0.7,
        });
      }
    }

    // Collect light bursts
    for (const b of lightBursts) {
      hasLight = true;
      bigBangParticles.push({
        x: b.x, y: b.y,
        originX: b.x, originY: b.y,
        targetX: cx, targetY: cy,
        size: 3 + Math.random() * 5,
        alpha: 0.6 + Math.random() * 0.4,
        phase: 0,
        explosionAngle: Math.random() * Math.PI * 2,
        explosionDist: 100 + Math.random() * Math.max(canvas.width, canvas.height) * 0.7,
      });
    }

    // Collect background stars
    for (const s of bgStars) {
      bigBangParticles.push({
        x: s.x, y: s.y,
        originX: s.x, originY: s.y,
        targetX: cx, targetY: cy,
        size: s.size + 1,
        alpha: 0.3 + Math.random() * 0.5,
        phase: 0,
        explosionAngle: Math.random() * Math.PI * 2,
        explosionDist: 80 + Math.random() * Math.max(canvas.width, canvas.height) * 0.6,
      });
    }

    // If not much light, create particles from edges
    if (!hasLight || bigBangParticles.length < 20) {
      const edgeCount = 40;
      for (let i = 0; i < edgeCount; i++) {
        let ex, ey;
        const side = Math.floor(Math.random() * 4);
        if (side === 0) { ex = Math.random() * canvas.width; ey = -5; }
        else if (side === 1) { ex = canvas.width + 5; ey = Math.random() * canvas.height; }
        else if (side === 2) { ex = Math.random() * canvas.width; ey = canvas.height + 5; }
        else { ex = -5; ey = Math.random() * canvas.height; }
        bigBangParticles.push({
          x: ex, y: ey,
          originX: ex, originY: ey,
          targetX: cx, targetY: cy,
          size: 1 + Math.random() * 3,
          alpha: 0.3 + Math.random() * 0.5,
          phase: 0,
          explosionAngle: Math.random() * Math.PI * 2,
          explosionDist: 100 + Math.random() * Math.max(canvas.width, canvas.height) * 0.7,
        });
      }
    }
  }

  function updateBigBang() {
    if (!bigBangActive) return;

    bigBangProgress += 0.012;
    const cx = canvas.width / 2;
    const cy = canvas.height / 2;

    if (bigBangPhase === 1) {
      // Implosion: all particles converge to center
      for (const p of bigBangParticles) {
        p.phase = Math.min(bigBangProgress / 0.5, 1);
        const t = easeOutCubic(p.phase);
        p.x = p.originX + (p.targetX - p.originX) * t;
        p.y = p.originY + (p.targetY - p.originY) * t;
        p.size *= 0.998; // shrink slightly
      }

      if (bigBangProgress >= 0.5) {
        bigBangPhase = 2;
        bigBangProgress = 0.5;
        // Reset phase for explosion
        for (const p of bigBangParticles) {
          p.phase = 0;
          p.originX = cx;
          p.originY = cy;
          p.x = cx;
          p.y = cy;
          p.size = 2 + Math.random() * 5;
          p.alpha = 0.7 + Math.random() * 0.3;
        }
      }
    } else if (bigBangPhase === 2) {
      // Explosion: all particles fly outward from center
      const explodeProgress = (bigBangProgress - 0.5) / 0.5;
      for (const p of bigBangParticles) {
        p.phase = Math.min(explodeProgress, 1);
        const t = easeOutCubic(p.phase);
        p.x = cx + Math.cos(p.explosionAngle) * p.explosionDist * t;
        p.y = cy + Math.sin(p.explosionAngle) * p.explosionDist * t;
        p.alpha = (1 - p.phase) * 0.8;
        p.size = (2 + Math.random() * 3) * (1 - p.phase * 0.5);
      }

      if (bigBangProgress >= 1.0) {
        bigBangActive = false;
        bigBangPhase = 0;
        bigBangParticles = [];
      }
    }
  }

  function drawBigBang() {
    if (!bigBangActive) return;
    const cx = canvas.width / 2;
    const cy = canvas.height / 2;

    // Draw particles
    for (const p of bigBangParticles) {
      if (p.alpha <= 0) continue;
      ctx.beginPath();
      ctx.arc(p.x, p.y, Math.max(p.size, 0.5), 0, Math.PI * 2);
      ctx.fillStyle = rgba(255, 255, 255, Math.max(p.alpha, 0));
      ctx.fill();
    }

    // Central glow during implosion/explosion
    if (bigBangPhase === 1) {
      const intensity = bigBangProgress / 0.5;
      const r = 20 + intensity * 40;
      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
      grad.addColorStop(0, rgba(255, 255, 255, intensity * 0.8));
      grad.addColorStop(1, rgba(255, 255, 255, 0));
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fillStyle = grad;
      ctx.fill();
    } else if (bigBangPhase === 2) {
      const explodeProgress = (bigBangProgress - 0.5) / 0.5;
      const intensity = 1 - explodeProgress;
      // Big flash at the beginning of explosion
      const flashR = 50 + explodeProgress * 200;
      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, flashR);
      grad.addColorStop(0, rgba(255, 255, 240, intensity * 0.9));
      grad.addColorStop(0.3, rgba(255, 255, 220, intensity * 0.4));
      grad.addColorStop(1, rgba(255, 255, 200, 0));
      ctx.beginPath();
      ctx.arc(cx, cy, flashR, 0, Math.PI * 2);
      ctx.fillStyle = grad;
      ctx.fill();

      // Shockwave ring
      if (explodeProgress < 0.6) {
        const ringR = explodeProgress * Math.max(canvas.width, canvas.height);
        ctx.beginPath();
        ctx.arc(cx, cy, ringR, 0, Math.PI * 2);
        ctx.strokeStyle = rgba(255, 255, 255, (1 - explodeProgress / 0.6) * 0.4);
        ctx.lineWidth = 3;
        ctx.stroke();
      }
    }
  }

  // --- Black Hole effect system (Off mode replacement for Big Bang) ---
  // A black hole appears at center and sucks in all white/bright pixels
  let blackHoleActive = false;
  let blackHoleProgress = 0; // 0-1 overall progress
  let blackHolePhase = 0; // 0=idle, 1=forming, 2=absorbing, 3=collapsing
  let blackHoleParticles = [];
  let blackHoleRadius = 0;
  let blackHoleRotation = 0;
  let nextBlackHoleTime = Date.now() + 30000 + Math.random() * 30000;

  function checkBlackHoleSpawn() {
    if (gameMode !== 'off') return;
    const bbCount = getUpgradeCount('bigbang');
    if (bbCount === 0) return;
    if (blackHoleActive) return;
    if (state.victoryReached || state.sunPurchased) return;
    if (Date.now() < nextBlackHoleTime) return;

    startBlackHole();
    const interval = Math.max(15000, 40000 - bbCount * 3000);
    nextBlackHoleTime = Date.now() + interval + Math.random() * interval * 0.5;
  }

  function startBlackHole() {
    blackHoleActive = true;
    blackHolePhase = 1; // forming
    blackHoleProgress = 0;
    blackHoleParticles = [];
    blackHoleRadius = 0;

    const cx = canvas.width / 2;
    const cy = canvas.height / 2;

    // Scan the canvas for bright pixels and create particles from them
    // Sample bright elements from existing visual systems
    let hasContent = false;

    // Collect from halos (glows/persists)
    for (const h of halos) {
      if ((h.type === 'glow' || h.type === 'persist') && h.life > 0.1) {
        hasContent = true;
        const dx = h.x - cx;
        const dy = h.y - cy;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const angle = Math.atan2(dy, dx);
        blackHoleParticles.push({
          x: h.x, y: h.y,
          originX: h.x, originY: h.y,
          angle: angle,
          dist: dist,
          size: 2 + Math.random() * 4,
          alpha: 0.6 + Math.random() * 0.4,
          spiralSpeed: 0.02 + Math.random() * 0.03,
          absorbed: false,
          stretch: 1,
          stretchAngle: angle,
        });
      }
    }

    // Collect from light bursts
    for (const b of lightBursts) {
      hasContent = true;
      const dx = b.x - cx;
      const dy = b.y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const angle = Math.atan2(dy, dx);
      blackHoleParticles.push({
        x: b.x, y: b.y,
        originX: b.x, originY: b.y,
        angle: angle,
        dist: dist,
        size: 3 + Math.random() * 5,
        alpha: 0.7 + Math.random() * 0.3,
        spiralSpeed: 0.015 + Math.random() * 0.025,
        absorbed: false,
        stretch: 1,
        stretchAngle: angle,
      });
    }

    // Collect from background stars
    for (const s of bgStars) {
      const dx = s.x - cx;
      const dy = s.y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const angle = Math.atan2(dy, dx);
      blackHoleParticles.push({
        x: s.x, y: s.y,
        originX: s.x, originY: s.y,
        angle: angle,
        dist: dist,
        size: s.size + 0.5,
        alpha: 0.3 + Math.random() * 0.4,
        spiralSpeed: 0.01 + Math.random() * 0.02,
        absorbed: false,
        stretch: 1,
        stretchAngle: angle,
      });
    }

    // If not much content, generate edge particles
    if (!hasContent || blackHoleParticles.length < 30) {
      const count = 60;
      for (let i = 0; i < count; i++) {
        // Scatter across entire screen
        const px = Math.random() * canvas.width;
        const py = Math.random() * canvas.height;
        const dx = px - cx;
        const dy = py - cy;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const angle = Math.atan2(dy, dx);
        blackHoleParticles.push({
          x: px, y: py,
          originX: px, originY: py,
          angle: angle,
          dist: dist,
          size: 1 + Math.random() * 3,
          alpha: 0.2 + Math.random() * 0.5,
          spiralSpeed: 0.01 + Math.random() * 0.03,
          absorbed: false,
          stretch: 1,
          stretchAngle: angle,
        });
      }
    }
  }

  function updateBlackHole() {
    if (!blackHoleActive) return;

    blackHoleProgress += 0.006;
    blackHoleRotation += 0.08;
    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    const maxR = Math.min(canvas.width, canvas.height) * 0.08;

    if (blackHolePhase === 1) {
      // Phase 1: Black hole forms (0 -> 0.15)
      blackHoleRadius = easeOutCubic(blackHoleProgress / 0.15) * maxR;

      if (blackHoleProgress >= 0.15) {
        blackHolePhase = 2; // start absorbing
      }
    } else if (blackHolePhase === 2) {
      // Phase 2: Absorbing (0.15 -> 0.75) — particles spiral inward
      blackHoleRadius = maxR;
      const absorbProgress = (blackHoleProgress - 0.15) / 0.6;
      let allAbsorbed = true;

      for (const p of blackHoleParticles) {
        if (p.absorbed) continue;

        // Spiral inward: decrease distance, rotate angle
        p.angle += p.spiralSpeed * (1 + (1 - p.dist / (Math.max(canvas.width, canvas.height) * 0.8)) * 3);
        p.dist *= (0.985 - absorbProgress * 0.01); // accelerate pull as time passes

        // Spaghettification: stretch particles as they approach
        const proximityFactor = Math.max(0, 1 - p.dist / 200);
        p.stretch = 1 + proximityFactor * 4;
        p.stretchAngle = p.angle + Math.PI; // stretch toward center

        // Update position
        p.x = cx + Math.cos(p.angle) * p.dist;
        p.y = cy + Math.sin(p.angle) * p.dist;

        // Absorbed when very close to center
        if (p.dist < maxR * 0.5) {
          p.absorbed = true;
          p.alpha = 0;
        } else {
          // Fade slightly as they approach
          p.alpha = Math.min(p.alpha, (p.dist / (maxR * 2)) * 0.8);
          allAbsorbed = false;
        }
      }

      if (allAbsorbed || blackHoleProgress >= 0.75) {
        blackHolePhase = 3; // collapse
      }
    } else if (blackHolePhase === 3) {
      // Phase 3: Black hole collapses (0.75 -> 1.0)
      const collapseProgress = Math.min((blackHoleProgress - 0.75) / 0.25, 1);
      blackHoleRadius = maxR * (1 - easeOutCubic(collapseProgress));

      // Absorb any remaining particles
      for (const p of blackHoleParticles) {
        if (!p.absorbed) {
          p.dist *= 0.9;
          p.angle += p.spiralSpeed * 5;
          p.x = cx + Math.cos(p.angle) * p.dist;
          p.y = cy + Math.sin(p.angle) * p.dist;
          p.alpha *= 0.9;
          if (p.dist < 5) p.absorbed = true;
        }
      }

      if (blackHoleProgress >= 1.0) {
        blackHoleActive = false;
        blackHolePhase = 0;
        blackHoleParticles = [];
        blackHoleRadius = 0;
      }
    }
  }

  function drawBlackHole() {
    if (!blackHoleActive) return;
    const cx = canvas.width / 2;
    const cy = canvas.height / 2;

    // Draw the accretion disk (swirling ring around black hole)
    if (blackHoleRadius > 2) {
      const diskRadius = blackHoleRadius * 2.5;
      const diskAlpha = blackHolePhase === 3
        ? Math.max(0, 1 - (blackHoleProgress - 0.75) / 0.25) * 0.15
        : 0.15;

      // Rotating accretion arms
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(blackHoleRotation);
      for (let i = 0; i < 4; i++) {
        const armAngle = (i / 4) * Math.PI * 2;
        // Each arm is a curved trail
        ctx.beginPath();
        for (let t = 0; t < 1; t += 0.02) {
          const spiralR = blackHoleRadius * 0.8 + t * (diskRadius - blackHoleRadius * 0.8);
          const spiralA = armAngle + t * Math.PI * 1.5; // 1.5 turns
          const sx = Math.cos(spiralA) * spiralR;
          const sy = Math.sin(spiralA) * spiralR;
          if (t === 0) ctx.moveTo(sx, sy);
          else ctx.lineTo(sx, sy);
        }
        // In off mode, the accretion disk glows dark (inverted colors via rgba)
        ctx.strokeStyle = rgba(255, 255, 255, diskAlpha * (1 - 0.15 * i));
        ctx.lineWidth = 2;
        ctx.stroke();
      }
      ctx.restore();

      // Gravitational lensing ring (bright edge around the event horizon)
      const lensGrad = ctx.createRadialGradient(cx, cy, blackHoleRadius * 0.7, cx, cy, blackHoleRadius * 1.3);
      lensGrad.addColorStop(0, rgba(255, 255, 255, 0));
      lensGrad.addColorStop(0.4, rgba(255, 255, 255, diskAlpha * 0.6));
      lensGrad.addColorStop(0.6, rgba(255, 255, 255, diskAlpha * 0.8));
      lensGrad.addColorStop(1, rgba(255, 255, 255, 0));
      ctx.beginPath();
      ctx.arc(cx, cy, blackHoleRadius * 1.3, 0, Math.PI * 2);
      ctx.fillStyle = lensGrad;
      ctx.fill();

      // The event horizon itself (solid dark circle)
      // In off mode: rgb inverts so white→black, this creates a dark void
      const holeGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, blackHoleRadius);
      holeGrad.addColorStop(0, rgba(0, 0, 0, 1));
      holeGrad.addColorStop(0.8, rgba(0, 0, 0, 0.95));
      holeGrad.addColorStop(1, rgba(0, 0, 0, 0.3));
      ctx.beginPath();
      ctx.arc(cx, cy, blackHoleRadius, 0, Math.PI * 2);
      ctx.fillStyle = holeGrad;
      ctx.fill();
    }

    // Draw particles being absorbed (with spaghettification)
    for (const p of blackHoleParticles) {
      if (p.absorbed || p.alpha <= 0) continue;

      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.stretchAngle);
      ctx.scale(p.stretch, 1 / Math.max(p.stretch * 0.5, 0.3)); // stretch toward center, compress perpendicular

      ctx.beginPath();
      ctx.arc(0, 0, Math.max(p.size, 0.5), 0, Math.PI * 2);
      ctx.fillStyle = rgba(255, 255, 255, Math.max(p.alpha, 0));
      ctx.fill();

      // Small glow around each particle
      if (p.size > 1.5) {
        const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, p.size * 2);
        glow.addColorStop(0, rgba(255, 255, 255, p.alpha * 0.3));
        glow.addColorStop(1, rgba(255, 255, 255, 0));
        ctx.beginPath();
        ctx.arc(0, 0, p.size * 2, 0, Math.PI * 2);
        ctx.fillStyle = glow;
        ctx.fill();
      }

      ctx.restore();
    }

    // Distortion effect: dark tendrils reaching outward during absorption
    if (blackHolePhase === 2) {
      const absorbProgress = (blackHoleProgress - 0.15) / 0.6;
      const tendrilCount = 6;
      const tendrilReach = blackHoleRadius * 3 * (1 - absorbProgress * 0.5);

      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(blackHoleRotation * 0.3);
      for (let i = 0; i < tendrilCount; i++) {
        const tAngle = (i / tendrilCount) * Math.PI * 2;
        const wobble = Math.sin(blackHoleRotation + i * 2.1) * 0.3;
        const endX = Math.cos(tAngle + wobble) * tendrilReach;
        const endY = Math.sin(tAngle + wobble) * tendrilReach;

        const tendrilGrad = ctx.createLinearGradient(0, 0, endX, endY);
        tendrilGrad.addColorStop(0, rgba(0, 0, 0, 0.3 * (1 - absorbProgress)));
        tendrilGrad.addColorStop(1, rgba(0, 0, 0, 0));

        ctx.beginPath();
        ctx.moveTo(0, 0);
        // Curved tendril using quadratic bezier
        const cpX = endX * 0.5 + Math.cos(tAngle + Math.PI / 2) * tendrilReach * 0.3;
        const cpY = endY * 0.5 + Math.sin(tAngle + Math.PI / 2) * tendrilReach * 0.3;
        ctx.quadraticCurveTo(cpX, cpY, endX, endY);
        ctx.strokeStyle = tendrilGrad;
        ctx.lineWidth = 3 + absorbProgress * 2;
        ctx.stroke();
      }
      ctx.restore();
    }
  }

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

    if (gameMode === 'off') {
      // OFF MODE: Void collapse — darkness implodes inward
      // Dark void pulse that contracts instead of expanding
      halos.push({
        type: 'void-collapse',
        x, y,
        maxRadius: (80 + 40) * scale,
        opacity: intensity * 0.7,
        life: 1.0,
        decay: 0.025,
        delay: 0,
      });

      // Contracting dark rings (start large, shrink to center)
      for (let i = 0; i < 3; i++) {
        halos.push({
          type: 'void-ring',
          x, y,
          maxRadius: (100 + i * 50) * scale,
          opacity: intensity * (0.6 - i * 0.15),
          life: 1.0,
          decay: 0.015 + i * 0.003,
          delay: i * 5,
        });
      }

      // Persistent dark stain
      halos.push({
        type: 'void-stain',
        x, y,
        maxRadius: 35 * scale,
        opacity: 0.12 + progress * 0.08,
        life: 1.0,
        decay: 0.004,
        delay: 3,
      });

      return;
    }

    // ON MODE: Light spreading outward
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
    for (const h of halos) {
      if (h.delay > 0) continue;

      const alpha = h.opacity * Math.max(h.life, 0);
      if (alpha <= 0) continue;

      const t = 1 - h.life;
      const radius = h.maxRadius * easeOutCubic(t);

      if (h.type === 'glow') {
        const r = Math.max(radius, 1);
        const gradient = ctx.createRadialGradient(h.x, h.y, 0, h.x, h.y, r);
        gradient.addColorStop(0, rgba(255, 255, 255, alpha));
        gradient.addColorStop(1, rgba(255, 255, 255, 0));
        ctx.beginPath();
        ctx.arc(h.x, h.y, r, 0, Math.PI * 2);
        ctx.fillStyle = gradient;
        ctx.fill();
      } else if (h.type === 'ring') {
        if (radius < 1) continue;
        const lineWidth = Math.max(0.5, 1.5 * h.life);
        ctx.beginPath();
        ctx.arc(h.x, h.y, radius, 0, Math.PI * 2);
        ctx.strokeStyle = rgba(255, 255, 255, alpha);
        ctx.lineWidth = lineWidth;
        ctx.stroke();
      } else if (h.type === 'persist') {
        // Soft lingering glow — fixed size, fades slowly
        const r = h.maxRadius;
        const gradient = ctx.createRadialGradient(h.x, h.y, 0, h.x, h.y, r);
        gradient.addColorStop(0, rgba(255, 255, 255, alpha * 0.7));
        gradient.addColorStop(0.4, rgba(255, 255, 255, alpha * 0.3));
        gradient.addColorStop(1, rgba(255, 255, 255, 0));
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
        ctx.fillStyle = rgba(255, 255, 255, alpha);
        ctx.fillText(h.text, h.x, floatY);
        ctx.restore();
      } else if (h.type === 'combo-glow') {
        // Warm golden glow indicating combo multiplier
        const r = Math.max(h.maxRadius, 1);
        const w = h.warmth || 0;
        const red = 255;
        const green = Math.floor(255 - w * 55);
        const blue = Math.floor(255 - w * 155);
        const gradient = ctx.createRadialGradient(h.x, h.y, 0, h.x, h.y, r);
        gradient.addColorStop(0, rgba(red, green, blue, alpha * 0.8));
        gradient.addColorStop(0.5, rgba(red, green, blue, alpha * 0.3));
        gradient.addColorStop(1, rgba(red, green, blue, 0));
        ctx.beginPath();
        ctx.arc(h.x, h.y, r, 0, Math.PI * 2);
        ctx.fillStyle = gradient;
        ctx.fill();
      } else if (h.type === 'combo-ring') {
        // Expanding warm ring for combo multiplier
        const r = h.maxRadius * easeOutCubic(1 - h.life);
        if (r < 1) continue;
        const w = h.warmth || 0;
        const red = 255;
        const green = Math.floor(255 - w * 55);
        const blue = Math.floor(255 - w * 155);
        const lineWidth = Math.max(0.5, 2 * h.life);
        ctx.beginPath();
        ctx.arc(h.x, h.y, r, 0, Math.PI * 2);
        ctx.strokeStyle = rgba(red, green, blue, alpha);
        ctx.lineWidth = lineWidth;
        ctx.stroke();
      } else if (h.type === 'void-collapse') {
        // OFF MODE: Dark void that contracts inward (reverse of glow)
        const collapseT = h.life; // life goes 1→0, so radius shrinks
        const r = Math.max(h.maxRadius * collapseT, 1);
        const gradient = ctx.createRadialGradient(h.x, h.y, 0, h.x, h.y, r);
        gradient.addColorStop(0, 'rgba(0, 0, 0, ' + (alpha * 0.9) + ')');
        gradient.addColorStop(0.4, 'rgba(20, 0, 30, ' + (alpha * 0.5) + ')');
        gradient.addColorStop(0.7, 'rgba(40, 0, 50, ' + (alpha * 0.2) + ')');
        gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.beginPath();
        ctx.arc(h.x, h.y, r, 0, Math.PI * 2);
        ctx.fillStyle = gradient;
        ctx.fill();
      } else if (h.type === 'void-ring') {
        // OFF MODE: Contracting ring (starts large, shrinks to center)
        const r = Math.max(h.maxRadius * h.life, 1);
        const lineWidth = Math.max(0.5, 2 * (1 - h.life));
        ctx.beginPath();
        ctx.arc(h.x, h.y, r, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(30, 0, 40, ' + alpha + ')';
        ctx.lineWidth = lineWidth;
        ctx.stroke();
      } else if (h.type === 'void-stain') {
        // OFF MODE: Persistent dark mark on the screen
        const r = h.maxRadius;
        const gradient = ctx.createRadialGradient(h.x, h.y, 0, h.x, h.y, r);
        gradient.addColorStop(0, 'rgba(0, 0, 0, ' + (alpha * 0.5) + ')');
        gradient.addColorStop(0.5, 'rgba(10, 0, 15, ' + (alpha * 0.2) + ')');
        gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.beginPath();
        ctx.arc(h.x, h.y, r, 0, Math.PI * 2);
        ctx.fillStyle = gradient;
        ctx.fill();
      } else if (h.type === 'void-crack') {
        // OFF MODE: Dark crack line effect from Fissure
        if (h.points && h.points.length >= 2) {
          const crackAlpha = alpha * 0.9;
          // Dark core
          ctx.beginPath();
          ctx.moveTo(h.points[0].x, h.points[0].y);
          for (let pi = 1; pi < h.points.length; pi++) {
            ctx.lineTo(h.points[pi].x, h.points[pi].y);
          }
          ctx.strokeStyle = 'rgba(0, 0, 0, ' + crackAlpha + ')';
          ctx.lineWidth = h.crackWidth || 2;
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          ctx.stroke();
          // Dark purple glow around crack
          ctx.beginPath();
          ctx.moveTo(h.points[0].x, h.points[0].y);
          for (let pi = 1; pi < h.points.length; pi++) {
            ctx.lineTo(h.points[pi].x, h.points[pi].y);
          }
          ctx.strokeStyle = 'rgba(60, 0, 80, ' + (crackAlpha * 0.4) + ')';
          ctx.lineWidth = (h.crackWidth || 2) * 5;
          ctx.stroke();
          // Outer eerie glow
          ctx.beginPath();
          ctx.moveTo(h.points[0].x, h.points[0].y);
          for (let pi = 1; pi < h.points.length; pi++) {
            ctx.lineTo(h.points[pi].x, h.points[pi].y);
          }
          ctx.strokeStyle = 'rgba(40, 0, 60, ' + (crackAlpha * 0.12) + ')';
          ctx.lineWidth = (h.crackWidth || 2) * 12;
          ctx.stroke();
        }
      } else if (h.type === 'void-implode') {
        // OFF MODE: Implosion effect (ring contracts then flash)
        const r = Math.max(h.maxRadius * h.life, 0);
        if (r > 1) {
          const gradient = ctx.createRadialGradient(h.x, h.y, r * 0.8, h.x, h.y, r);
          gradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
          gradient.addColorStop(0.5, 'rgba(20, 0, 30, ' + (alpha * 0.6) + ')');
          gradient.addColorStop(1, 'rgba(0, 0, 0, ' + (alpha * 0.3) + ')');
          ctx.beginPath();
          ctx.arc(h.x, h.y, r, 0, Math.PI * 2);
          ctx.fillStyle = gradient;
          ctx.fill();
        }
        // Inner dark core growing
        const coreR = h.maxRadius * (1 - h.life) * 0.3;
        if (coreR > 0.5) {
          const coreGrad = ctx.createRadialGradient(h.x, h.y, 0, h.x, h.y, coreR);
          coreGrad.addColorStop(0, 'rgba(0, 0, 0, ' + (alpha * 0.8) + ')');
          coreGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
          ctx.beginPath();
          ctx.arc(h.x, h.y, coreR, 0, Math.PI * 2);
          ctx.fillStyle = coreGrad;
          ctx.fill();
        }
      } else if (h.type === 'cold-glow') {
        // OFF MODE: Cold blue-purple glow for combo
        const r = Math.max(radius, 1);
        const coldness = h.warmth || 0; // reuse warmth as coldness
        const rr = Math.floor(30 + coldness * 30);
        const gg = 0;
        const bb = Math.floor(60 + coldness * 100);
        const gradient = ctx.createRadialGradient(h.x, h.y, 0, h.x, h.y, r);
        gradient.addColorStop(0, 'rgba(' + rr + ', ' + gg + ', ' + bb + ', ' + (alpha * 0.7) + ')');
        gradient.addColorStop(0.5, 'rgba(' + rr + ', ' + gg + ', ' + bb + ', ' + (alpha * 0.25) + ')');
        gradient.addColorStop(1, 'rgba(' + rr + ', ' + gg + ', ' + bb + ', 0)');
        ctx.beginPath();
        ctx.arc(h.x, h.y, r, 0, Math.PI * 2);
        ctx.fillStyle = gradient;
        ctx.fill();
      } else if (h.type === 'cold-ring') {
        // OFF MODE: Cold contracting ring for combo
        const r = h.maxRadius * h.life; // contracts instead of expanding
        if (r < 1) continue;
        const coldness = h.warmth || 0;
        const rr = Math.floor(30 + coldness * 30);
        const bb = Math.floor(60 + coldness * 100);
        const lineWidth = Math.max(0.5, 2.5 * (1 - h.life));
        ctx.beginPath();
        ctx.arc(h.x, h.y, r, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(' + rr + ', 0, ' + bb + ', ' + alpha + ')';
        ctx.lineWidth = lineWidth;
        ctx.stroke();
      } else if (h.type === 'screen-darken') {
        // OFF MODE: Screen darkens momentarily (Fissure effect)
        ctx.fillStyle = 'rgba(0, 0, 0, ' + alpha + ')';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      } else if (h.type === 'screen-flash') {
        // Gentle full-screen flash for lightning bonus (epilepsy-safe)
        ctx.fillStyle = rgba(255, 255, 255, alpha);
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      } else if (h.type === 'edge-dark') {
        // OFF MODE: Dark vignette creeping from edges
        const w = canvas.width;
        const ht = canvas.height;
        const thickness = h.maxRadius;
        const topG = ctx.createLinearGradient(0, 0, 0, thickness);
        topG.addColorStop(0, 'rgba(0, 0, 0, ' + alpha + ')');
        topG.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = topG;
        ctx.fillRect(0, 0, w, thickness);
        const botG = ctx.createLinearGradient(0, ht, 0, ht - thickness);
        botG.addColorStop(0, 'rgba(0, 0, 0, ' + alpha + ')');
        botG.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = botG;
        ctx.fillRect(0, ht - thickness, w, thickness);
        const leftG = ctx.createLinearGradient(0, 0, thickness, 0);
        leftG.addColorStop(0, 'rgba(0, 0, 0, ' + alpha + ')');
        leftG.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = leftG;
        ctx.fillRect(0, 0, thickness, ht);
        const rightG = ctx.createLinearGradient(w, 0, w - thickness, 0);
        rightG.addColorStop(0, 'rgba(0, 0, 0, ' + alpha + ')');
        rightG.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = rightG;
        ctx.fillRect(w - thickness, 0, thickness, ht);
      } else if (h.type === 'edge') {
        // ON MODE: Vignette glow from screen edges
        const w = canvas.width;
        const ht = canvas.height;
        const thickness = h.maxRadius;
        const topG = ctx.createLinearGradient(0, 0, 0, thickness);
        topG.addColorStop(0, rgba(255, 255, 255, alpha));
        topG.addColorStop(1, rgba(255, 255, 255, 0));
        ctx.fillStyle = topG;
        ctx.fillRect(0, 0, w, thickness);
        const botG = ctx.createLinearGradient(0, ht, 0, ht - thickness);
        botG.addColorStop(0, rgba(255, 255, 255, alpha));
        botG.addColorStop(1, rgba(255, 255, 255, 0));
        ctx.fillStyle = botG;
        ctx.fillRect(0, ht - thickness, w, thickness);
        const leftG = ctx.createLinearGradient(0, 0, thickness, 0);
        leftG.addColorStop(0, rgba(255, 255, 255, alpha));
        leftG.addColorStop(1, rgba(255, 255, 255, 0));
        ctx.fillStyle = leftG;
        ctx.fillRect(0, 0, thickness, ht);
        const rightG = ctx.createLinearGradient(w, 0, w - thickness, 0);
        rightG.addColorStop(0, rgba(255, 255, 255, alpha));
        rightG.addColorStop(1, rgba(255, 255, 255, 0));
        ctx.fillStyle = rightG;
        ctx.fillRect(w - thickness, 0, thickness, ht);
      }
    }
  }

  // --- Edge glow (upgrade reward) ---
  function addEdgeGlow() {
    if (gameMode === 'off') {
      // OFF MODE: Dark vignette creeping in from edges
      halos.push({
        type: 'edge-dark',
        x: 0, y: 0,
        maxRadius: 120,
        opacity: 0.12,
        life: 1.0,
        decay: 0.008,
        delay: 0,
      });
    } else {
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

    // Generate particles along the rub path
    if (rubDistance >= RUB_THRESHOLD) {
      const rubPower = Math.max(1, Math.floor(state.clickPower * 0.3));
      state.lumens += rubPower;
      state.totalLumens += rubPower;
      rubDistance -= RUB_THRESHOLD;

      if (gameMode === 'off') {
        // OFF MODE: Shadow wisps — dark smoke trails
        halos.push({
          type: 'void-stain',
          x: x + (Math.random() - 0.5) * 10,
          y: y + (Math.random() - 0.5) * 10,
          maxRadius: 10 + Math.random() * 15,
          opacity: 0.25 + Math.random() * 0.2,
          life: 1.0,
          decay: 0.04,
          delay: 0,
        });
      } else {
      // ON MODE: Small spark particle
      halos.push({
        type: 'glow',
        x, y,
        maxRadius: 8 + Math.random() * 12,
        opacity: 0.3 + Math.random() * 0.3,
        life: 1.0,
        decay: 0.06,
        delay: 0,
      });
      }

      checkMilestones();
      updateUI();
    }
  }

  // NOTE: halos use the rgba() helper in drawHalos so colors auto-invert

  function endRub() {
    isRubbing = false;
    rubDistance = 0;
  }

  gameArea.addEventListener('mousedown', function (e) {
    if (e.target.closest('#upgrade-panel') || e.target.closest('#upgrade-toggle') || e.target.closest('#switch-container')) return;
    startRub(e.clientX, e.clientY);
    startPrismHold(e.clientX, e.clientY);
    startConstellationDrag(e.clientX, e.clientY);
  });
  gameArea.addEventListener('mousemove', function (e) {
    mouseX = e.clientX;
    mouseY = e.clientY;
    if (e.target.closest('#upgrade-panel')) return;
    moveRub(e.clientX, e.clientY);
    movePrismHold(e.clientX, e.clientY);
    moveConstellationDrag(e.clientX, e.clientY);
  });
  gameArea.addEventListener('mouseup', function () { endRub(); endPrismHold(); endConstellationDrag(); });
  gameArea.addEventListener('mouseleave', function () { endRub(); endPrismHold(); endConstellationDrag(); });

  gameArea.addEventListener('touchmove', function (e) {
    if (e.target.closest('#upgrade-panel')) return;
    e.preventDefault();
    const touch = e.touches[0];
    mouseX = touch.clientX;
    mouseY = touch.clientY;
    moveRub(touch.clientX, touch.clientY);
    movePrismHold(touch.clientX, touch.clientY);
    moveConstellationDrag(touch.clientX, touch.clientY);
  }, { passive: false });

  gameArea.addEventListener('touchend', function () { endRub(); endPrismHold(); endConstellationDrag(); });
  gameArea.addEventListener('touchcancel', function () { endRub(); endPrismHold(); endConstellationDrag(); });

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

  function showComboGlow(x, y, multiplier) {
    const glowSize = 30 + multiplier * 20;
    const warmth = Math.min(multiplier / 5, 1); // 0-1 factor

    if (gameMode === 'off') {
      // OFF MODE: Cold void glow — dark purple pulsing
      halos.push({
        type: 'cold-glow',
        x, y,
        maxRadius: glowSize,
        opacity: 0.35 + multiplier * 0.12,
        life: 1.0,
        decay: 0.015,
        delay: 0,
        warmth: warmth,
      });
      // Contracting cold ring
      halos.push({
        type: 'cold-ring',
        x, y,
        maxRadius: glowSize * 2.5,
        opacity: 0.25 + multiplier * 0.1,
        life: 1.0,
        decay: 0.02,
        delay: 0,
        warmth: warmth,
      });
    } else {
      // ON MODE: Warm golden glow
      halos.push({
        type: 'combo-glow',
        x, y,
        maxRadius: glowSize,
        opacity: 0.3 + multiplier * 0.1,
        life: 1.0,
        decay: 0.015,
        delay: 0,
        warmth: warmth,
      });
      halos.push({
        type: 'combo-ring',
        x, y,
        maxRadius: glowSize * 2,
        opacity: 0.2 + multiplier * 0.08,
        life: 1.0,
        decay: 0.02,
        delay: 0,
        warmth: warmth,
      });
    }
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
      showComboGlow(x, y, multiplier);
    }

    // Lightning/Fissure: bolt animation + flash/darken
    const lightningCount = getUpgradeCount('lightning');
    if (lightningCount > 0) {
      if (gameMode === 'off') {
        // OFF MODE: Fissure — dark cracks in reality + screen darkens
        const hasFlash = halos.some(function (h) { return h.type === 'screen-darken' && h.life > 0.5; });
        if (!hasFlash) {
          const darkenIntensity = Math.min(0.06 + lightningCount * 0.01, 0.15);
          halos.push({
            type: 'screen-darken',
            x: 0, y: 0,
            maxRadius: 0,
            opacity: darkenIntensity,
            life: 1.0,
            decay: 0.03,
            delay: 0,
          });

          // Spawn dark cracks instead of lightning bolts
          const crackCount = Math.min(1 + Math.floor(lightningCount / 3), 4);
          for (let c = 0; c < crackCount; c++) {
            spawnFissureCrack(x, y, lightningCount, c * 2);
          }
        }
      } else {
        // ON MODE: Lightning bolts + screen flash
        const hasFlash = halos.some(function (h) { return h.type === 'screen-flash' && h.life > 0.5; });
        if (!hasFlash) {
          const flashIntensity = Math.min(0.04 + lightningCount * 0.008, 0.12);
          halos.push({
            type: 'screen-flash',
            x: 0, y: 0,
            maxRadius: 0,
            opacity: flashIntensity,
            life: 1.0,
            decay: 0.04,
            delay: 0,
          });

          const boltCount = Math.min(1 + Math.floor(lightningCount / 4), 3);
          for (let bolt = 0; bolt < boltCount; bolt++) {
            spawnLightningBolt(x, y, lightningCount, bolt * 3);
          }
        }
      }
    }
    checkMilestones();
    updateUI();
  }

  gameArea.addEventListener('click', handleClick);
  gameArea.addEventListener('touchstart', function (e) {
    if (e.target.closest('#upgrade-panel') || e.target.closest('#upgrade-toggle') || e.target.closest('#victory-screen') || e.target.closest('#switch-container')) return;
    e.preventDefault();
    const touch = e.touches[0];
    mouseX = touch.clientX;
    mouseY = touch.clientY;
    startRub(touch.clientX, touch.clientY);
    startPrismHold(touch.clientX, touch.clientY);
    startConstellationDrag(touch.clientX, touch.clientY);
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

    if (!adminMode && state.lumens < cost) return;
    if (count >= upgrade.maxCount) return;

    if (!adminMode) {
      state.lumens -= cost;
    }
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
    if (upgrade.id === 'star' || upgrade.id === 'constellation') {
      regenerateStars();
    }
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
    const unit = unitName();
    lumenCounter.textContent = formatNumber(Math.floor(state.lumens)) + ' ' + unit;
    upgradeList.innerHTML = '';

    let nextShown = false; // only show one upcoming unpurchased upgrade

    for (const up of UPGRADES) {
      const count = getUpgradeCount(up.id);
      const unlocked = state.totalLumens >= up.unlockAt;

      // In admin mode show all upgrades; otherwise show purchased + next unlocked
      if (count === 0) {
        if (adminMode) {
          // show all upgrades in admin mode
        } else if (!unlocked || nextShown) {
          continue;
        } else {
          nextShown = true;
        }
      }

      const cost = getUpgradeCost(up);
      const canAfford = adminMode || state.lumens >= cost;
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

      const displayName = getUpgradeName(up);
      const displayDesc = getUpgradeDesc(up);

      const costLabel = isMaxed ? 'MAX' : (adminMode ? 'GRATUIT' : formatNumber(cost) + ' ' + unit);
      item.innerHTML = `
        <div class="upgrade-name">${displayName}</div>
        <div class="upgrade-desc">${displayDesc}</div>
        <div class="upgrade-cost">${costLabel}</div>
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
    // In Off mode, lever starts in "on" position (top) and will flip down
    if (gameMode === 'off') {
      switchLever.classList.add('on');
    }
  }

  lightSwitch.addEventListener('click', function (e) {
    e.stopPropagation();
    if (!state.sunPurchased || sunCinematicActive) return;

    // Flip the switch
    if (gameMode === 'off') {
      switchLever.classList.remove('on'); // lever goes down (turning off)
    } else {
      switchLever.classList.add('on'); // lever goes up (turning on)
    }

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
    lightningBolts.length = 0;
    bgStars.length = 0;
    lastStarCount = 0;
    activeConstellations.length = 0;
    bigBangActive = false;
    bigBangPhase = 0;
    bigBangParticles = [];
    blackHoleActive = false;
    blackHolePhase = 0;
    blackHoleParticles = [];
    blackHoleRadius = 0;

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

    // Phase 1: Sun/Void appears and grows (0 -> 0.4)
    // Phase 2: Rays expand outward (0.3 -> 0.7)
    // Phase 3: Screen fills with white/black (0.6 -> 1.0)

    // Cinematic colors based on mode
    const isOff = gameMode === 'off';
    // Off mode: dark void consuming light. On mode: bright sun filling darkness.
    function cinRgba(r, g, b, a) {
      if (isOff) return 'rgba(' + (255 - r) + ', ' + (255 - g) + ', ' + (255 - b) + ', ' + a + ')';
      return 'rgba(' + r + ', ' + g + ', ' + b + ', ' + a + ')';
    }
    const fillEnd = isOff ? '#000' : '#fff';

    function animateCinematic() {
      sunCinematicProgress += 0.003;

      cinCtx.clearRect(0, 0, cinCanvas.width, cinCanvas.height);

      if (sunCinematicProgress < 1.0) {
        // Phase 1: Growing core
        if (sunCinematicProgress < 0.5) {
          const phase1 = sunCinematicProgress / 0.5;
          const sunRadius = easeOutCubic(phase1) * 60;
          const glowRadius = easeOutCubic(phase1) * 200;
          const alpha = easeOutCubic(phase1);

          // Outer warm glow
          const outerGlow = cinCtx.createRadialGradient(centerX, centerY, 0, centerX, centerY, glowRadius);
          outerGlow.addColorStop(0, cinRgba(255, 240, 200, alpha * 0.4));
          outerGlow.addColorStop(0.3, cinRgba(255, 220, 150, alpha * 0.2));
          outerGlow.addColorStop(1, cinRgba(255, 200, 100, 0));
          cinCtx.beginPath();
          cinCtx.arc(centerX, centerY, glowRadius, 0, Math.PI * 2);
          cinCtx.fillStyle = outerGlow;
          cinCtx.fill();

          // Core
          const coreGlow = cinCtx.createRadialGradient(centerX, centerY, 0, centerX, centerY, sunRadius);
          coreGlow.addColorStop(0, cinRgba(255, 255, 255, alpha));
          coreGlow.addColorStop(0.6, cinRgba(255, 250, 230, alpha * 0.8));
          coreGlow.addColorStop(1, cinRgba(255, 240, 200, 0));
          cinCtx.beginPath();
          cinCtx.arc(centerX, centerY, sunRadius, 0, Math.PI * 2);
          cinCtx.fillStyle = coreGlow;
          cinCtx.fill();
        }

        // Phase 2: Rays burst
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
            rayGrad.addColorStop(0, cinRgba(255, 255, 240, rayAlpha * 0.8));
            rayGrad.addColorStop(1, cinRgba(255, 255, 240, 0));

            cinCtx.beginPath();
            cinCtx.moveTo(centerX, centerY);
            cinCtx.lineTo(endX, endY);
            cinCtx.strokeStyle = rayGrad;
            cinCtx.lineWidth = 3 + phase2 * 8;
            cinCtx.stroke();
          }

          // Persistent core during rays
          const sunR = 60 + phase2 * 30;
          const coreGlow = cinCtx.createRadialGradient(centerX, centerY, 0, centerX, centerY, sunR);
          coreGlow.addColorStop(0, cinRgba(255, 255, 255, 1));
          coreGlow.addColorStop(0.5, cinRgba(255, 250, 230, 0.9));
          coreGlow.addColorStop(1, cinRgba(255, 240, 200, 0));
          cinCtx.beginPath();
          cinCtx.arc(centerX, centerY, sunR, 0, Math.PI * 2);
          cinCtx.fillStyle = coreGlow;
          cinCtx.fill();
        }

        // Phase 3: Flood fills the screen
        if (sunCinematicProgress >= 0.55) {
          const phase3 = (sunCinematicProgress - 0.55) / 0.45;
          const floodRadius = easeOutCubic(phase3) * maxRadius;
          const floodAlpha = easeOutCubic(phase3);

          const flood = cinCtx.createRadialGradient(centerX, centerY, 0, centerX, centerY, floodRadius);
          flood.addColorStop(0, cinRgba(255, 255, 255, floodAlpha));
          flood.addColorStop(0.6, cinRgba(255, 255, 255, floodAlpha * 0.8));
          flood.addColorStop(1, cinRgba(255, 255, 255, floodAlpha * 0.3));
          cinCtx.beginPath();
          cinCtx.arc(centerX, centerY, floodRadius, 0, Math.PI * 2);
          cinCtx.fillStyle = flood;
          cinCtx.fill();
        }

        requestAnimationFrame(animateCinematic);
      } else {
        // Cinematic done — fill then show victory
        cinCtx.fillStyle = fillEnd;
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
    localStorage.removeItem(getSaveKey());
    localStorage.removeItem('light-game-mode');
    // Reload to return to mode selection
    window.location.reload();
  });

  // --- Reset button ---
  const resetBtn = document.getElementById('reset-btn');
  resetBtn.addEventListener('click', function (e) {
    e.stopPropagation();
    localStorage.removeItem(getSaveKey());
    localStorage.removeItem('light-game-mode');
    window.location.reload();
  });

  // --- Admin mode toggle ---
  let adminMode = false;
  const adminCheckbox = document.getElementById('admin-checkbox');
  adminCheckbox.addEventListener('change', function (e) {
    e.stopPropagation();
    adminMode = adminCheckbox.checked;
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
    const cometCount = getUpgradeCount('comet');
    const bonusPercent = 0.03 + cometCount * 0.005;
    const baseBonus = Math.max(10, Math.floor(state.totalLumens * bonusPercent));
    const bonus = baseBonus + Math.floor(Math.random() * baseBonus);

    // Random initial wander direction
    const angle = Math.random() * Math.PI * 2;
    const speed = 0.08 + Math.random() * 0.12; // very slow drift

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
      twinkleTimer: 120 + Math.floor(Math.random() * 300), // frames until next twinkle
      twinkleActive: 0, // frames remaining of current twinkle
      twinkleDuration: 0, // total duration of current twinkle
    });
  }

  function checkBurstSpawn() {
    if (state.victoryReached || state.sunPurchased) return;
    const fireflyCount = getUpgradeCount('firefly');
    const cometCount = getUpgradeCount('comet');
    if (fireflyCount === 0 && cometCount === 0) return;
    const maxBursts = 3 + Math.floor(cometCount / 2);
    const baseInterval = Math.max(5000, 10000 - cometCount * 250);
    const randomExtra = Math.max(3000, 15000 - cometCount * 500);
    if (Date.now() >= nextBurstTime && lightBursts.length < maxBursts) {
      spawnLightBurst();
      nextBurstTime = Date.now() + baseInterval + Math.random() * randomExtra;
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

        // Wander: very gently rotate direction
        b.wanderAngle += (Math.random() - 0.5) * 0.1;
        // Occasional gentle turns
        if (Math.random() < 0.005) {
          b.wanderAngle += (Math.random() - 0.5) * 0.8;
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

      // Twinkle timer: occasional brief bright flash
      if (b.twinkleActive > 0) {
        b.twinkleActive--;
      } else {
        b.twinkleTimer--;
        if (b.twinkleTimer <= 0) {
          const dur = 10 + Math.floor(Math.random() * 10); // 10-20 frames
          b.twinkleActive = dur;
          b.twinkleDuration = dur;
          b.twinkleTimer = 120 + Math.floor(Math.random() * 300); // 2-7s until next
        }
      }
    }
  }

  function drawLightBursts() {
    for (const b of lightBursts) {
      const lifeFade = Math.min(b.life * 2, 1); // fade in then out

      // Twinkle progress (brief bright flash)
      const twinkleT = b.twinkleDuration > 0 ? b.twinkleActive / b.twinkleDuration : 0;
      const twinkleIntensity = b.twinkleActive > 0 ? Math.sin(twinkleT * Math.PI) : 0;

      // Subtle base glow with gentle pulsing
      const flickerBase = Math.sin(b.pulse * 0.8 + b.flickerPhase);
      const flicker = 0.25 + 0.1 * flickerBase;
      const alpha = lifeFade * Math.min(flicker + twinkleIntensity * 0.75, 1.0);

      const pulseScale = 1 + 0.05 * Math.sin(b.pulse);
      const twinkleScale = 1 + twinkleIntensity * 0.4;
      const r = b.radius * pulseScale * twinkleScale;

      if (gameMode === 'off') {
        // OFF MODE: Dark shadow entities — eerie, unsettling presence
        // Outer dark aura (cold, menacing)
        const gradient = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, r * 3);
        gradient.addColorStop(0, 'rgba(0, 0, 0, ' + (alpha * 0.5) + ')');
        gradient.addColorStop(0.3, 'rgba(20, 0, 35, ' + (alpha * 0.25) + ')');
        gradient.addColorStop(0.6, 'rgba(40, 0, 50, ' + (alpha * 0.08) + ')');
        gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.beginPath();
        ctx.arc(b.x, b.y, r * 3, 0, Math.PI * 2);
        ctx.fillStyle = gradient;
        ctx.fill();

        // Core — dark void center
        const core = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, r * 0.8);
        core.addColorStop(0, 'rgba(0, 0, 0, ' + (alpha * 0.85) + ')');
        core.addColorStop(0.6, 'rgba(15, 0, 25, ' + (alpha * 0.5) + ')');
        core.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.beginPath();
        ctx.arc(b.x, b.y, r * 0.8, 0, Math.PI * 2);
        ctx.fillStyle = core;
        ctx.fill();

        // Twinkle: brief dark purple flash (like a shadow flickering)
        if (twinkleIntensity > 0.1) {
          const flashR = r * 1.5 * twinkleIntensity;
          const flash = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, flashR);
          flash.addColorStop(0, 'rgba(60, 0, 80, ' + (twinkleIntensity * alpha * 0.6) + ')');
          flash.addColorStop(1, 'rgba(30, 0, 50, 0)');
          ctx.beginPath();
          ctx.arc(b.x, b.y, flashR, 0, Math.PI * 2);
          ctx.fillStyle = flash;
          ctx.fill();
        }
      } else {
        // ON MODE: Warm firefly glow (slight yellow-green tint)
        // Outer glow — warm halo
        const gradient = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, r * 2.5);
        gradient.addColorStop(0, rgba(255, 255, 220, alpha * 0.4));
        gradient.addColorStop(0.4, rgba(255, 255, 220, alpha * 0.12));
        gradient.addColorStop(1, rgba(255, 255, 220, 0));
        ctx.beginPath();
        ctx.arc(b.x, b.y, r * 2.5, 0, Math.PI * 2);
        ctx.fillStyle = gradient;
        ctx.fill();

        // Core — bright center
        const core = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, r * 0.7);
        core.addColorStop(0, rgba(255, 255, 240, alpha * 0.9));
        core.addColorStop(1, rgba(255, 255, 240, alpha * 0.15));
        ctx.beginPath();
        ctx.arc(b.x, b.y, r * 0.7, 0, Math.PI * 2);
        ctx.fillStyle = core;
        ctx.fill();
      }
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

        const explosionScale = Math.min(b.bonus / 100, 5) + 1;
        const explosionIntensity = Math.min(0.6 + explosionScale * 0.15, 1.0);

        if (gameMode === 'off') {
          // OFF MODE: Implosion — darkness collapses inward, terrifying void

          // Void implosion (ring contracts to center)
          halos.push({
            type: 'void-implode',
            x: b.x, y: b.y,
            maxRadius: 80 * explosionScale,
            opacity: explosionIntensity * 0.8,
            life: 1.0,
            decay: 0.018,
            delay: 0,
          });

          // Dark stain left behind
          halos.push({
            type: 'void-stain',
            x: b.x, y: b.y,
            maxRadius: 50 * explosionScale,
            opacity: explosionIntensity * 0.4,
            life: 1.0,
            decay: 0.005,
            delay: 0,
          });

          // Contracting void rings
          const ringCount = Math.min(2 + Math.floor(explosionScale), 5);
          for (let r = 0; r < ringCount; r++) {
            halos.push({
              type: 'void-ring',
              x: b.x, y: b.y,
              maxRadius: (70 + r * 40) * explosionScale,
              opacity: explosionIntensity * (0.6 - r * 0.1),
              life: 1.0,
              decay: 0.012 + r * 0.003,
              delay: r * 3,
            });
          }
        } else {
          // ON MODE: Light explosion outward
          halos.push({
            type: 'glow',
            x: b.x, y: b.y,
            maxRadius: 60 * explosionScale,
            opacity: explosionIntensity,
            life: 1.0,
            decay: 0.015,
            delay: 0,
          });

          halos.push({
            type: 'persist',
            x: b.x, y: b.y,
            maxRadius: 80 * explosionScale,
            opacity: explosionIntensity * 0.5,
            life: 1.0,
            decay: 0.006,
            delay: 0,
          });

          const ringCount = Math.min(2 + Math.floor(explosionScale), 6);
          for (let r = 0; r < ringCount; r++) {
            halos.push({
              type: 'ring',
              x: b.x, y: b.y,
              maxRadius: (60 + r * 35) * explosionScale,
              opacity: explosionIntensity * (1 - r * 0.12),
              life: 1.0,
              decay: 0.01 + r * 0.003,
              delay: r * 4,
            });
          }

          const particleCount = Math.min(4 + Math.floor(explosionScale * 2), 14);
          for (let p = 0; p < particleCount; p++) {
            const angle = (p / particleCount) * Math.PI * 2 + Math.random() * 0.3;
            const pdist = 30 + Math.random() * 50 * explosionScale;
            halos.push({
              type: 'glow',
              x: b.x + Math.cos(angle) * pdist,
              y: b.y + Math.sin(angle) * pdist,
              maxRadius: 15 + Math.random() * 20 * explosionScale,
              opacity: explosionIntensity * (0.4 + Math.random() * 0.3),
              life: 1.0,
              decay: 0.02 + Math.random() * 0.015,
              delay: 2 + Math.floor(Math.random() * 6),
            });
          }
        }

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
      colorAngles: null,    // random angles for rainbow rays (set on first touch)
      lastHoldX: 0,
      lastHoldY: 0,
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
          ray.fadeOutSpeed = 0; // reset accelerated fade

          // Initialize color angles on first touch (random directions)
          if (!ray.colorAngles) {
            ray.colorAngles = [];
            for (let c = 0; c < 7; c++) {
              ray.colorAngles.push(Math.random() * Math.PI * 2);
            }
            ray.lastHoldX = prismHoldX;
            ray.lastHoldY = prismHoldY;
          }

          // Move angles only based on player movement (no per-frame animation)
          const moveDx = prismHoldX - ray.lastHoldX;
          const moveDy = prismHoldY - ray.lastHoldY;
          const moveDist = Math.sqrt(moveDx * moveDx + moveDy * moveDy);
          if (moveDist > 1) {
            const shift = moveDist * 0.03;
            for (let c = 0; c < ray.colorAngles.length; c++) {
              ray.colorAngles[c] += shift * ((c % 2 === 0) ? 1 : -1) * (0.5 + c * 0.1);
            }
            ray.lastHoldX = prismHoldX;
            ray.lastHoldY = prismHoldY;
          }

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

      ctx.save();

      if (gameMode === 'off') {
        // OFF MODE: Onyx — dark absorption ray that swallows light
        ctx.beginPath();
        ctx.moveTo(ray.startX, ray.startY);
        ctx.lineTo(ray.endX, ray.endY);
        const baseWidth = ray.active ? 4 : 2.5;

        // Dark ray core
        const grad = ctx.createLinearGradient(ray.startX, ray.startY, ray.endX, ray.endY);
        grad.addColorStop(0, 'rgba(0, 0, 0, 0)');
        grad.addColorStop(0.15, 'rgba(0, 0, 0, ' + alpha + ')');
        grad.addColorStop(0.85, 'rgba(0, 0, 0, ' + alpha + ')');
        grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.strokeStyle = grad;
        ctx.lineWidth = baseWidth;
        ctx.stroke();

        // Dark purple glow around the ray
        ctx.beginPath();
        ctx.moveTo(ray.startX, ray.startY);
        ctx.lineTo(ray.endX, ray.endY);
        ctx.strokeStyle = 'rgba(40, 0, 60, ' + (alpha * 0.2) + ')';
        ctx.lineWidth = baseWidth * 8;
        ctx.stroke();

        // If active: draw absorption vortex (anti-prism — swallows light)
        if (ray.active && prismHolding) {
          const result = pointToRayDistance(prismHoldX, prismHoldY, ray);
          const prismCount = getUpgradeCount('prism');
          const holdIntensity = Math.min(ray.holdTime / 60, 3);
          const prismIntensity = 1 + prismCount * 0.15;
          const totalIntensity = Math.min(holdIntensity * prismIntensity, 4);

          // Dark absorption vortex at hold point
          const vortexSize = 50 + totalIntensity * 40;
          const vortexGlow = ctx.createRadialGradient(
            result.cx, result.cy, 0,
            result.cx, result.cy, vortexSize
          );
          vortexGlow.addColorStop(0, 'rgba(0, 0, 0, ' + (alpha * Math.min(0.8 + totalIntensity * 0.1, 1.0)) + ')');
          vortexGlow.addColorStop(0.3, 'rgba(20, 0, 30, ' + (alpha * Math.min(0.4 + totalIntensity * 0.1, 0.7)) + ')');
          vortexGlow.addColorStop(0.7, 'rgba(40, 0, 60, ' + (alpha * 0.15) + ')');
          vortexGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
          ctx.beginPath();
          ctx.arc(result.cx, result.cy, vortexSize, 0, Math.PI * 2);
          ctx.fillStyle = vortexGlow;
          ctx.fill();

          // Spiral absorption arms (light being sucked in)
          const armCount = 5;
          const spiralReach = 80 + totalIntensity * 50;
          const spiralPhase = ray.colorAngles ? ray.colorAngles[0] : 0;

          ctx.save();
          ctx.translate(result.cx, result.cy);
          for (let a = 0; a < armCount; a++) {
            const baseAngle = (a / armCount) * Math.PI * 2 + spiralPhase;
            ctx.beginPath();
            for (let t = 0; t < 1; t += 0.03) {
              const spiralR = vortexSize * 0.3 + t * (spiralReach - vortexSize * 0.3);
              const spiralA = baseAngle + t * Math.PI * 2;
              const sx = Math.cos(spiralA) * spiralR;
              const sy = Math.sin(spiralA) * spiralR;
              if (t === 0) ctx.moveTo(sx, sy);
              else ctx.lineTo(sx, sy);
            }
            const armAlpha = Math.min(ray.holdTime / 30, 1) * alpha;
            ctx.strokeStyle = 'rgba(0, 0, 0, ' + (armAlpha * 0.5) + ')';
            ctx.lineWidth = 1.5 + totalIntensity * 0.5;
            ctx.stroke();
          }
          ctx.restore();

          // Periodic void pulse
          if (ray.holdTime % 20 === 0 && ray.holdTime > 0) {
            const lumensThisBurst = ray.lumensGenerated;
            if (lumensThisBurst > 0) {
              const burstIntensity = Math.min(lumensThisBurst / 50, 1.5) + 0.3;
              halos.push({
                type: 'void-collapse',
                x: result.cx + (Math.random() - 0.5) * 20,
                y: result.cy + (Math.random() - 0.5) * 20,
                maxRadius: 40 * burstIntensity,
                opacity: 0.4 * burstIntensity,
                life: 1.0,
                decay: 0.03,
                delay: 0,
              });
              ray.lumensGenerated = 0;
            }
          }
        }

        // Dying ray effect
        if (ray.life < 0.5) {
          const fadeAlpha = ray.life / 0.5;
          ctx.beginPath();
          ctx.moveTo(ray.startX, ray.startY);
          ctx.lineTo(ray.endX, ray.endY);
          ctx.strokeStyle = 'rgba(0, 0, 0, ' + ((1 - fadeAlpha) * 0.2) + ')';
          ctx.lineWidth = 1;
          ctx.setLineDash([3, 10]);
          ctx.stroke();
          ctx.setLineDash([]);
        }

      } else {
        // ON MODE: Classic prism with rainbow dispersion
        ctx.beginPath();
        ctx.moveTo(ray.startX, ray.startY);
        ctx.lineTo(ray.endX, ray.endY);
        const baseWidth = ray.active ? 3 : 2;

        const grad = ctx.createLinearGradient(ray.startX, ray.startY, ray.endX, ray.endY);
        grad.addColorStop(0, rgba(255, 255, 255, 0));
        grad.addColorStop(0.15, rgba(255, 255, 255, alpha));
        grad.addColorStop(0.85, rgba(255, 255, 255, alpha));
        grad.addColorStop(1, rgba(255, 255, 255, 0));
        ctx.strokeStyle = grad;
        ctx.lineWidth = baseWidth;
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(ray.startX, ray.startY);
        ctx.lineTo(ray.endX, ray.endY);
        ctx.strokeStyle = rgba(255, 255, 255, alpha * 0.15);
        ctx.lineWidth = baseWidth * 6;
        ctx.stroke();

        if (ray.active && prismHolding) {
          const result = pointToRayDistance(prismHoldX, prismHoldY, ray);
          const prismCount = getUpgradeCount('prism');
          const holdIntensity = Math.min(ray.holdTime / 60, 3);
          const prismIntensity = 1 + prismCount * 0.15;
          const totalIntensity = Math.min(holdIntensity * prismIntensity, 4);

          const glowSize = 60 + totalIntensity * 30;
          const prismGlow = ctx.createRadialGradient(
            result.cx, result.cy, 0,
            result.cx, result.cy, glowSize
          );
          prismGlow.addColorStop(0, rgba(255, 255, 255, alpha * Math.min(0.9 + totalIntensity * 0.1, 1.0)));
          prismGlow.addColorStop(0.3, rgba(255, 255, 255, alpha * Math.min(0.3 + totalIntensity * 0.15, 0.8)));
          prismGlow.addColorStop(1, rgba(255, 255, 255, 0));
          ctx.beginPath();
          ctx.arc(result.cx, result.cy, glowSize, 0, Math.PI * 2);
          ctx.fillStyle = prismGlow;
          ctx.fill();

          const rayLength = 100 + totalIntensity * 60;
          const rayWidth = 2.5 + totalIntensity * 1.5;

          for (let c = 0; c < RAINBOW.length; c++) {
            const angle = ray.colorAngles ? ray.colorAngles[c] : 0;
            const endRX = result.cx + Math.cos(angle) * rayLength;
            const endRY = result.cy + Math.sin(angle) * rayLength;

            const holdAlpha = Math.min(ray.holdTime / 30, 1) * alpha;
            const intensifiedAlpha = Math.min(holdAlpha * (1 + totalIntensity * 0.3), 1.0);

            ctx.beginPath();
            ctx.moveTo(result.cx, result.cy);
            ctx.lineTo(endRX, endRY);
            ctx.strokeStyle = RAINBOW[c] + (intensifiedAlpha * 0.7) + ')';
            ctx.lineWidth = rayWidth;
            ctx.stroke();

            const glowR = 10 + totalIntensity * 8;
            ctx.beginPath();
            ctx.arc(endRX, endRY, glowR, 0, Math.PI * 2);
            ctx.fillStyle = RAINBOW[c] + (intensifiedAlpha * 0.4) + ')';
            ctx.fill();

            if (totalIntensity > 1.5) {
              ctx.beginPath();
              ctx.moveTo(result.cx, result.cy);
              ctx.lineTo(endRX, endRY);
              ctx.strokeStyle = RAINBOW[c] + (intensifiedAlpha * 0.15) + ')';
              ctx.lineWidth = rayWidth * 4;
              ctx.stroke();
            }
          }

          if (ray.holdTime % 20 === 0 && ray.holdTime > 0) {
            const lumensThisBurst = ray.lumensGenerated;
            if (lumensThisBurst > 0) {
              const burstIntensity = Math.min(lumensThisBurst / 50, 1.5) + 0.3;
              halos.push({
                type: 'glow',
                x: result.cx + (Math.random() - 0.5) * 20,
                y: result.cy + (Math.random() - 0.5) * 20,
                maxRadius: 30 * burstIntensity,
                opacity: 0.5 * burstIntensity,
                life: 1.0,
                decay: 0.03,
                delay: 0,
              });
              ray.lumensGenerated = 0;
            }
          }
        }

        if (ray.life < 0.5) {
          const fadeAlpha = ray.life / 0.5;
          ctx.beginPath();
          ctx.moveTo(ray.startX, ray.startY);
          ctx.lineTo(ray.endX, ray.endY);
          ctx.strokeStyle = rgba(255, 255, 255, (1 - fadeAlpha) * 0.3);
          ctx.lineWidth = baseWidth * 0.5;
          ctx.setLineDash([4, 8]);
          ctx.stroke();
          ctx.setLineDash([]);
        }
      }

      ctx.restore();
    }
  }

  // --- Lightning bolt system ---
  const lightningBolts = [];

  function generateBoltPath(x1, y1, x2, y2, detail, jitter) {
    // Generate a jagged lightning bolt path between two points
    const points = [{ x: x1, y: y1 }];
    const dx = x2 - x1;
    const dy = y2 - y1;
    const segments = detail || 8;

    for (let i = 1; i < segments; i++) {
      const t = i / segments;
      const offsetX = (Math.random() - 0.5) * jitter;
      const offsetY = (Math.random() - 0.5) * jitter * 0.3;
      points.push({
        x: x1 + dx * t + offsetX,
        y: y1 + dy * t + offsetY,
      });
    }
    points.push({ x: x2, y: y2 });
    return points;
  }

  function spawnLightningBolt(clickX, clickY, lightningCount, delay) {
    const intensity = Math.min(0.5 + lightningCount * 0.08, 1.2);
    // Bolt goes from top of screen (or random edge) down toward click point
    const startSide = Math.random();
    let startX, startY;

    if (startSide < 0.6) {
      // From top
      startX = clickX + (Math.random() - 0.5) * canvas.width * 0.4;
      startY = -10;
    } else if (startSide < 0.8) {
      // From left
      startX = -10;
      startY = Math.random() * canvas.height * 0.4;
    } else {
      // From right
      startX = canvas.width + 10;
      startY = Math.random() * canvas.height * 0.4;
    }

    const jitter = 80 + lightningCount * 10;
    const segments = 8 + Math.floor(lightningCount / 2);
    const mainPath = generateBoltPath(startX, startY, clickX, clickY, segments, jitter);

    // Generate branches
    const branches = [];
    const branchCount = Math.min(1 + Math.floor(lightningCount / 3), 5);
    for (let b = 0; b < branchCount; b++) {
      const branchIdx = 2 + Math.floor(Math.random() * (mainPath.length - 3));
      const branchStart = mainPath[branchIdx];
      const branchAngle = Math.atan2(clickY - startY, clickX - startX) + (Math.random() - 0.5) * 1.5;
      const branchLen = 40 + Math.random() * 80 * intensity;
      const branchEnd = {
        x: branchStart.x + Math.cos(branchAngle) * branchLen,
        y: branchStart.y + Math.sin(branchAngle) * branchLen,
      };
      branches.push(generateBoltPath(branchStart.x, branchStart.y, branchEnd.x, branchEnd.y, 4, jitter * 0.5));
    }

    lightningBolts.push({
      mainPath: mainPath,
      branches: branches,
      life: 1.0,
      decay: 0.035, // ~28 frames (~0.47s)
      intensity: intensity,
      delay: delay || 0,
      glowWidth: 3 + lightningCount * 0.5,
    });

    // Impact glow at click point
    halos.push({
      type: 'glow',
      x: clickX, y: clickY,
      maxRadius: 50 * intensity,
      opacity: 0.7 * intensity,
      life: 1.0,
      decay: 0.03,
      delay: delay || 0,
    });
  }

  // OFF MODE: Fissure — dark cracks in reality
  function spawnFissureCrack(clickX, clickY, count, delay) {
    const intensity = Math.min(0.6 + count * 0.08, 1.2);
    // Cracks radiate outward from click point in random directions
    const crackAngle = Math.random() * Math.PI * 2;
    const crackLen = 80 + Math.random() * 120 + count * 15;
    const endX = clickX + Math.cos(crackAngle) * crackLen;
    const endY = clickY + Math.sin(crackAngle) * crackLen;

    // Generate a jagged crack path
    const segments = 6 + Math.floor(count / 2);
    const jitter = 30 + count * 5;
    const points = [{ x: clickX, y: clickY }];
    const dx = endX - clickX;
    const dy = endY - clickY;

    for (let i = 1; i < segments; i++) {
      const t = i / segments;
      points.push({
        x: clickX + dx * t + (Math.random() - 0.5) * jitter,
        y: clickY + dy * t + (Math.random() - 0.5) * jitter * 0.5,
      });
    }
    points.push({ x: endX, y: endY });

    // Add crack as a halo with custom rendering
    halos.push({
      type: 'void-crack',
      x: clickX, y: clickY,
      maxRadius: crackLen,
      opacity: intensity * 0.9,
      life: 1.0,
      decay: 0.02,
      delay: delay || 0,
      points: points,
      crackWidth: 2 + count * 0.4,
    });

    // Spawn secondary micro-cracks branching off
    const branchCount = Math.min(1 + Math.floor(count / 4), 3);
    for (let b = 0; b < branchCount; b++) {
      const branchIdx = 1 + Math.floor(Math.random() * (segments - 1));
      const branchPt = points[branchIdx];
      const branchAngle = crackAngle + (Math.random() - 0.5) * 1.5;
      const branchLen = 20 + Math.random() * 50;
      const branchEnd = {
        x: branchPt.x + Math.cos(branchAngle) * branchLen,
        y: branchPt.y + Math.sin(branchAngle) * branchLen,
      };
      const branchPoints = [branchPt];
      for (let s = 1; s < 3; s++) {
        const bt = s / 3;
        branchPoints.push({
          x: branchPt.x + (branchEnd.x - branchPt.x) * bt + (Math.random() - 0.5) * jitter * 0.3,
          y: branchPt.y + (branchEnd.y - branchPt.y) * bt + (Math.random() - 0.5) * jitter * 0.3,
        });
      }
      branchPoints.push(branchEnd);

      halos.push({
        type: 'void-crack',
        x: branchPt.x, y: branchPt.y,
        maxRadius: branchLen,
        opacity: intensity * 0.5,
        life: 1.0,
        decay: 0.025,
        delay: (delay || 0) + 2,
        points: branchPoints,
        crackWidth: 1 + count * 0.2,
      });
    }

    // Dark void at click impact
    halos.push({
      type: 'void-collapse',
      x: clickX, y: clickY,
      maxRadius: 40 * intensity,
      opacity: 0.6 * intensity,
      life: 1.0,
      decay: 0.025,
      delay: delay || 0,
    });
  }

  function updateLightningBolts() {
    for (let i = lightningBolts.length - 1; i >= 0; i--) {
      const bolt = lightningBolts[i];
      if (bolt.delay > 0) {
        bolt.delay--;
        continue;
      }
      bolt.life -= bolt.decay;
      if (bolt.life <= 0) {
        lightningBolts.splice(i, 1);
      }
    }
  }

  function drawBoltPath(points, alpha, width) {
    if (points.length < 2) return;
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
      ctx.lineTo(points[i].x, points[i].y);
    }
    // Bright core
    ctx.strokeStyle = rgba(255, 255, 255, alpha);
    ctx.lineWidth = width;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();

    // Electric blue-white glow
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
      ctx.lineTo(points[i].x, points[i].y);
    }
    ctx.strokeStyle = rgba(200, 220, 255, alpha * 0.4);
    ctx.lineWidth = width * 4;
    ctx.stroke();

    // Outer soft glow
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
      ctx.lineTo(points[i].x, points[i].y);
    }
    ctx.strokeStyle = rgba(180, 200, 255, alpha * 0.12);
    ctx.lineWidth = width * 10;
    ctx.stroke();
  }

  function drawLightningBolts() {
    for (const bolt of lightningBolts) {
      if (bolt.delay > 0) continue;
      // Flicker effect: lightning naturally flickers
      const flicker = 0.7 + Math.random() * 0.3;
      const alpha = Math.max(bolt.life, 0) * bolt.intensity * flicker;
      if (alpha <= 0) continue;

      ctx.save();
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      // Draw main bolt
      drawBoltPath(bolt.mainPath, alpha, bolt.glowWidth);

      // Draw branches (thinner)
      for (const branch of bolt.branches) {
        drawBoltPath(branch, alpha * 0.6, bolt.glowWidth * 0.5);
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
      ray.colorAngles = null; // reset so next touch gets fresh random angles
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
      localStorage.setItem(getSaveKey(), JSON.stringify(data));
    } catch (_) {
      // silently fail if storage unavailable
    }
  }

  function load() {
    try {
      const raw = localStorage.getItem(getSaveKey());
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
      regenerateStars();
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
    if (n >= 1000000000000) return (n / 1000000000000).toFixed(1) + 'T';
    if (n >= 1000000000) return (n / 1000000000).toFixed(1) + 'B';
    if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
    if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
    return Math.floor(n).toString();
  }

  // --- Game loop ---
  function gameLoop() {
    // Update systems
    regenerateStars();
    updateStars();
    updatePulsar();
    updateConstellations();
    checkConstellationSpawn();
    updateBigBang();
    checkBigBangSpawn();
    updateBlackHole();
    checkBlackHoleSpawn();
    updateHalos();
    updateLightBursts();
    updatePrismRays();
    updateLightningBolts();
    checkBurstSpawn();
    checkRaySpawn();

    // Clear canvas then draw (back to front)
    if (gameMode === 'off') {
      // In off mode, canvas must be transparent (white body shows through)
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    } else {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    drawStars();
    drawConstellations();
    drawHalos();
    drawBigBang();
    drawBlackHole();
    drawLightningBolts();
    drawPrismRays();
    drawLightBursts();
    drawPulsar();
    requestAnimationFrame(gameLoop);
  }

  // --- Init (called after mode selection) ---
  function initGame() {
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
  }

})();
