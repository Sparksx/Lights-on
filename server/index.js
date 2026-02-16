'use strict';

require('dotenv').config();

const express = require('express');
const http = require('http');
const path = require('path');
const session = require('express-session');
const PgSession = require('connect-pg-simple')(session);
const { Server } = require('socket.io');
const { pool, initDB, getCurrentSeason, addToCosmicWar, recordContribution } = require('./db');
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

// --- Auth routes ---
setupAuthRoutes(app);

// --- API routes ---
app.get('/api/cosmic-war', async (req, res) => {
  try {
    const season = await getCurrentSeason();
    if (!season) return res.json({ totalLight: 0, totalDark: 0, season: 0 });
    res.json({
      season: season.season,
      totalLight: Number(season.total_light),
      totalDark: Number(season.total_dark),
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
  socket.on('join', (data) => {
    const side = data?.side === 'off' ? 'off' : 'on';
    players.set(socket.id, {
      userId: user?.id || null,
      displayName: user?.display_name || 'Anonymous',
      side,
    });
    broadcastOnline();
  });

  // Player reports lumens earned (batched, sent periodically by client)
  socket.on('contribute', async (data) => {
    if (!user?.id) return; // Must be logged in
    const amount = Number(data?.amount) || 0;
    if (amount <= 0) return;

    const player = players.get(socket.id);
    if (!player) return;

    try {
      const totals = await addToCosmicWar(player.side, amount);
      if (totals) {
        // Record individual contribution
        await recordContribution(user.id, player.side, amount);
        // Broadcast updated war state to all
        io.emit('cosmic-war', {
          totalLight: Number(totals.total_light),
          totalDark: Number(totals.total_dark),
        });
      }
    } catch (err) {
      console.error('[socket] contribute error:', err);
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

// --- Start ---
async function start() {
  try {
    await initDB();
    console.log('[server] Database ready');
  } catch (err) {
    console.error('[server] Database init failed:', err.message);
    console.log('[server] Starting without database — auth and cosmic war will be unavailable');
  }

  server.listen(PORT, () => {
    console.log(`[server] Lights-on running on port ${PORT}`);
  });
}

start();
