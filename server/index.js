'use strict';

require('dotenv').config();

const express = require('express');
const http = require('http');
const path = require('path');
const session = require('express-session');
const PgSession = require('connect-pg-simple')(session);
const { Server } = require('socket.io');
const {
  pool,
  initDB,
  getCurrentSeason,
  addToCosmicWar,
  recordContribution,
  getPlayerProfile,
  updateStreak,
  getStreakMultiplier,
  setPlayerContributionRate,
  getLeaderboard,
  checkAndEndSeason,
  getUnclaimedRewards,
  claimReward,
  getSeasonInfo,
} = require('./db');
const { passport, setupAuthRoutes } = require('./auth');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

// --- Session middleware (shared between Express and Socket.io) ---
const sessionMiddleware = session({
  store: new PgSession({ pool, tableName: 'session' }),
  secret: process.env.SESSION_SECRET || 'lights-on-dev-secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
  },
});

app.set('trust proxy', 1);
app.use(sessionMiddleware);
app.use(passport.initialize());
app.use(passport.session());
app.use(express.json());

// --- Auth routes ---
setupAuthRoutes(app);

// --- API routes ---
app.get('/api/cosmic-war', async (req, res) => {
  try {
    const info = await getSeasonInfo();
    if (!info) return res.json({ totalLight: 0, totalDark: 0, season: 0 });
    res.json({
      season: info.season,
      totalLight: info.totalLight,
      totalDark: info.totalDark,
      remainingMs: info.remainingMs,
      remainingDays: info.remainingDays,
      isLastDay: info.isLastDay,
      endsAt: info.endsAt,
    });
  } catch (err) {
    console.error('[api] cosmic-war error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/online', (req, res) => {
  res.json({
    total: io.engine.clientsCount,
    light: countBySide('on'),
    dark: countBySide('off'),
  });
});

// --- Player profile (grade, streak, contribution, prestige bonus) ---
app.get('/api/profile', async (req, res) => {
  try {
    const user = req.session?.passport?.user;
    if (!user?.id) return res.json(null);

    const profile = await getPlayerProfile(user.id);
    res.json(profile);
  } catch (err) {
    console.error('[api] profile error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// --- Set contribution rate ---
app.post('/api/contribution-rate', async (req, res) => {
  try {
    const user = req.session?.passport?.user;
    if (!user?.id) return res.status(401).json({ error: 'Not authenticated' });

    const rate = Number(req.body?.rate);
    const success = await setPlayerContributionRate(user.id, rate);
    if (!success) return res.status(400).json({ error: 'Invalid rate. Must be 10, 25, 50, or 100.' });

    res.json({ ok: true, rate });
  } catch (err) {
    console.error('[api] contribution-rate error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// --- Leaderboard ---
app.get('/api/leaderboard', async (req, res) => {
  try {
    const user = req.session?.passport?.user;
    const leaderboard = await getLeaderboard(user?.id || null);
    res.json(leaderboard);
  } catch (err) {
    console.error('[api] leaderboard error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// --- Unclaimed season rewards ---
app.get('/api/rewards', async (req, res) => {
  try {
    const user = req.session?.passport?.user;
    if (!user?.id) return res.json([]);

    const rewards = await getUnclaimedRewards(user.id);
    res.json(rewards);
  } catch (err) {
    console.error('[api] rewards error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// --- Claim a reward ---
app.post('/api/rewards/claim', async (req, res) => {
  try {
    const user = req.session?.passport?.user;
    if (!user?.id) return res.status(401).json({ error: 'Not authenticated' });

    const rewardId = Number(req.body?.rewardId);
    if (!rewardId) return res.status(400).json({ error: 'Missing rewardId' });

    const reward = await claimReward(user.id, rewardId);
    if (!reward) return res.status(404).json({ error: 'Reward not found or already claimed' });

    res.json(reward);
  } catch (err) {
    console.error('[api] claim error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// --- Static files (serve the game) ---
app.use(express.static(path.join(__dirname, '..')));

// --- Socket.io: share session with websocket ---
io.engine.use(sessionMiddleware);

// Track connected players per side
const players = new Map(); // socketId -> { userId, side, displayName }

function countBySide(side) {
  let count = 0;
  for (const p of players.values()) {
    if (p.side === side) count++;
  }
  return count;
}

function broadcastOnline() {
  io.emit('online', {
    total: players.size,
    light: countBySide('on'),
    dark: countBySide('off'),
  });
}

io.on('connection', (socket) => {
  const session = socket.request.session;
  const user = session?.passport?.user || null;

  // Player joins with their current game mode
  socket.on('join', async (data) => {
    const side = data?.side === 'off' ? 'off' : 'on';
    players.set(socket.id, {
      userId: user?.id || null,
      displayName: user?.display_name || 'Anonymous',
      side,
    });
    broadcastOnline();

    // Send player their profile if authenticated
    if (user?.id) {
      try {
        const profile = await getPlayerProfile(user.id);
        socket.emit('profile', profile);

        // Send unclaimed rewards
        const rewards = await getUnclaimedRewards(user.id);
        if (rewards.length > 0) {
          socket.emit('season-rewards', rewards);
        }
      } catch (err) {
        console.error('[socket] profile error:', err);
      }
    }
  });

  // Player reports lumens earned (batched, sent periodically by client)
  socket.on('contribute', async (data) => {
    if (!user?.id) return; // Must be logged in
    const amount = Number(data?.amount) || 0;
    if (amount <= 0) return;

    const player = players.get(socket.id);
    if (!player) return;

    try {
      // Update streak
      const streakDays = await updateStreak(user.id);
      const streakMult = streakDays > 0 ? getStreakMultiplier(streakDays) : 1.0;

      // Apply streak multiplier to contribution
      const boostedAmount = Math.floor(amount * streakMult);

      const totals = await addToCosmicWar(player.side, boostedAmount);
      if (totals) {
        // Record individual contribution
        await recordContribution(user.id, player.side, boostedAmount);
        // Broadcast updated war state to all
        io.emit('cosmic-war', {
          totalLight: Number(totals.total_light),
          totalDark: Number(totals.total_dark),
        });

        // Send updated profile back to this player (grade may have changed)
        const profile = await getPlayerProfile(user.id);
        socket.emit('profile', profile);
      }
    } catch (err) {
      console.error('[socket] contribute error:', err);
    }
  });

  // Player changes contribution rate
  socket.on('set-contribution-rate', async (data) => {
    if (!user?.id) return;
    const rate = Number(data?.rate);
    await setPlayerContributionRate(user.id, rate);
  });

  // Player claims a season reward
  socket.on('claim-reward', async (data) => {
    if (!user?.id) return;
    const rewardId = Number(data?.rewardId);
    if (!rewardId) return;

    try {
      const reward = await claimReward(user.id, rewardId);
      if (reward) {
        socket.emit('reward-claimed', reward);
        // Send updated profile (prestige bonus updated)
        const profile = await getPlayerProfile(user.id);
        socket.emit('profile', profile);
      }
    } catch (err) {
      console.error('[socket] claim-reward error:', err);
    }
  });

  // Player changes side
  socket.on('switch-side', (data) => {
    const player = players.get(socket.id);
    if (!player) return;
    player.side = data?.side === 'off' ? 'off' : 'on';
    broadcastOnline();
  });

  socket.on('disconnect', () => {
    players.delete(socket.id);
    broadcastOnline();
  });
});

// --- Season lifecycle check (every 60 seconds) ---
let seasonCheckRunning = false;

async function seasonCheck() {
  if (seasonCheckRunning) return;
  seasonCheckRunning = true;

  try {
    const result = await checkAndEndSeason();
    if (result) {
      console.log(`[server] Season ${result.endedSeason} ended! Winner: ${result.winner}`);
      // Broadcast season end to all connected players
      io.emit('season-end', {
        endedSeason: result.endedSeason,
        winner: result.winner,
        totalLight: result.totalLight,
        totalDark: result.totalDark,
        newSeason: result.newSeason,
      });
    }
  } catch (err) {
    console.error('[server] Season check error:', err);
  }

  seasonCheckRunning = false;
}

// --- Start ---
async function start() {
  try {
    await initDB();
    console.log('[server] Database ready');

    // Run season check on start and every 60 seconds
    seasonCheck();
    setInterval(seasonCheck, 60 * 1000);
  } catch (err) {
    console.error('[server] Database init failed:', err.message);
    console.log('[server] Starting without database — auth and cosmic war will be unavailable');
  }

  server.listen(PORT, () => {
    console.log(`[server] Lights-on running on port ${PORT}`);
  });
}

start();
