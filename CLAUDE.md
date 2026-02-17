# CLAUDE.md — AI Assistant Guide for Lights-on

## Project Overview

**Light** is a progressive web app (PWA) incremental/clicker game with a philosophical dual-mode design. Players choose between "Lights ON" (bringing light to darkness) or "Lights OFF" (bringing darkness to light), then accumulate lumens (or "obscurs" in OFF mode) through clicking, rubbing/swiping, and upgrades to reach 1 trillion units and trigger a victory condition.

The game includes a multiplayer "Cosmic War" feature where authenticated players contribute their earnings to a global light-vs-dark tally, tracked per season.

- **Language**: French (all user-facing text is in French)
- **Tech stack**: Vanilla HTML/CSS/JavaScript frontend (ES modules, zero build tools) + Node.js/Express backend for multiplayer
- **No build system**: No bundler, no transpiler. Frontend files are served directly as static assets.

## File Structure

```
/
├── index.html              # Entry point — HTML structure, PWA meta, script loading
├── style.css               # All styling (~1,340 lines)
├── sw.js                   # Service Worker — network-first caching (v9)
├── manifest.json           # PWA manifest (standalone, portrait, black theme)
├── package.json            # Root package.json (postinstall + start scripts)
├── Procfile                # Heroku/Railway process definition
├── railway.json            # Railway deployment config
├── .gitignore              # node_modules, .env
├── README.md               # Minimal project readme
├── ANALYSIS.md             # French-language improvement proposals document
├── CLAUDE.md               # This file
├── icons/
│   ├── icon.svg            # 512x512 app icon
│   └── icon-192.svg        # 192x192 app icon
├── js/                     # Frontend modules (ES module imports)
│   ├── main.js             # Entry point — mode selection, init, multiplayer UI (~310 lines)
│   ├── state.js            # Core game state, prestige, mode, shared flags (~70 lines)
│   ├── utils.js            # Protected native refs, color helpers, formatting (~42 lines)
│   ├── dom.js              # Cached DOM element references (~30 lines)
│   ├── canvas.js           # Canvas element, context, resize handler (~12 lines)
│   ├── upgrades-data.js    # UPGRADES array (24 upgrades + victory), SHADOW_THEME, cost calc (~317 lines)
│   ├── upgrades.js         # Upgrade purchasing, recalcPassive, milestones, rendering (~214 lines)
│   ├── click.js            # Canvas click/touch event handlers (~171 lines)
│   ├── interaction.js      # Rubbing/swiping mechanic, combo system, anti-auto-clicker (~423 lines)
│   ├── save.js             # Save/load to localStorage (~42 lines)
│   ├── ui.js               # HUD rendering, progress bar, counter updates (~59 lines)
│   ├── game-loop.js        # requestAnimationFrame loop, passive income tick (~71 lines)
│   ├── victory.js          # Light switch, sun/eclipse cinematic, prestige, restart (~222 lines)
│   ├── intro.js            # New-game cinematic overlay (~34 lines)
│   ├── multiplayer.js      # Socket.io client, auth, cosmic war state, lumen reporting (~114 lines)
│   ├── onboarding.js       # Progressive multiplayer introduction at 60K lumens (~140 lines)
│   └── effects/            # Visual effect systems
│       ├── stars.js        # Star particles (~74 lines)
│       ├── constellations.js # Constellation line patterns (~292 lines)
│       ├── pulsar.js       # Pulsating central effect (~153 lines)
│       ├── prism.js        # Prism ray beams (~329 lines)
│       ├── lightning.js    # Lightning bolt effects (~150 lines)
│       ├── bursts.js       # Light/dark burst particles (~218 lines)
│       ├── halos.js        # Halo ring effects (~368 lines)
│       ├── bigbang.js      # Big bang explosion effect (~205 lines)
│       └── blackhole.js    # Black hole visual effect (~282 lines)
└── server/                 # Backend for multiplayer features
    ├── index.js            # Express + Socket.io server, API routes (~159 lines)
    ├── auth.js             # Passport.js OAuth (Google + Discord) (~104 lines)
    ├── db.js               # PostgreSQL pool, schema init, queries (~100 lines)
    ├── schema.sql          # Database schema (users, cosmic_war, contributions, session) (~47 lines)
    ├── package.json        # Server dependencies
    └── .env.example        # Required environment variables template
```

## Architecture

### Frontend — Modular ES modules (`js/`)

The game was refactored from a single IIFE (`game.js`) into ES modules loaded via `<script type="module" src="js/main.js">`. Modules communicate through:

- **Shared imports**: All modules import from `state.js` for the canonical game state
- **Direct imports**: Modules import specific functions from each other
- **Callback pattern**: `multiplayer.js` uses `onMultiplayerUpdate(fn)` listener registration
- **Window globals**: `window._onOnboardingDone` bridges onboarding → main.js

#### Module dependency graph (simplified)

```
main.js (entry point)
├── state.js          (game state, prestige, constants)
├── utils.js          (color helpers, formatNumber, protected refs)
├── dom.js            (cached DOM elements)
├── canvas.js         (canvas + context)
├── save.js           (localStorage persistence)
├── upgrades.js       (purchasing, milestones, rendering)
│   └── upgrades-data.js (UPGRADES, SHADOW_THEME, cost calc)
├── ui.js             (HUD, progress bar)
├── game-loop.js      (rAF loop, passive tick)
│   └── effects/*     (all visual effect modules)
├── click.js          (click/touch input)
├── interaction.js    (rub/swipe, combo, anti-cheat)
├── victory.js        (switch, cinematic, prestige, restart)
├── intro.js          (new-game cinematic)
├── multiplayer.js    (socket.io, auth, cosmic war)
└── onboarding.js     (multiplayer onboarding at 60K lumens)
```

### Script loading order (index.html)

1. `<script src="/socket.io/socket.io.js" defer>` — Socket.io client (auto-served by the server)
2. `<script type="module" src="js/main.js">` — Game entry point (loads all other modules)
3. Inline `<script>` — Service Worker registration and auto-reload on SW update

### Backend — Node.js server (`server/`)

- **Framework**: Express 4 + Socket.io 4
- **Database**: PostgreSQL via `pg` driver
- **Auth**: Passport.js with Google OAuth2 and Discord OAuth2 strategies
- **Sessions**: `express-session` with `connect-pg-simple` (stored in PostgreSQL)
- **Static serving**: `express.static()` serves the entire project root as static files

#### API endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/cosmic-war` | GET | Current season totals (light vs dark) |
| `/api/online` | GET | Connected player counts (total, light, dark) — also used as healthcheck |
| `/auth/google` | GET | Initiate Google OAuth |
| `/auth/google/callback` | GET | Google OAuth callback |
| `/auth/discord` | GET | Initiate Discord OAuth |
| `/auth/discord/callback` | GET | Discord OAuth callback |
| `/auth/me` | GET | Current authenticated user (or null) |
| `/auth/logout` | POST | Logout |

#### Socket.io events

| Event | Direction | Purpose |
|-------|-----------|---------|
| `join` | Client → Server | Player joins with side (`on`/`off`) |
| `contribute` | Client → Server | Batch-report earned lumens (every 10s) |
| `switch-side` | Client → Server | Player changed game mode |
| `cosmic-war` | Server → Client | Updated light/dark totals |
| `online` | Server → Client | Updated online player counts |

#### Database schema

- **`session`** — Express session store (connect-pg-simple)
- **`users`** — Player accounts (UUID PK, google_id, discord_id, display_name, avatar_url)
- **`cosmic_war`** — Season-based light vs dark totals (total_light, total_dark bigint)
- **`contributions`** — Per-player lumen contributions per season

#### Environment variables (see `server/.env.example`)

| Variable | Required | Description |
|----------|----------|-------------|
| `PORT` | No | Server port (default 3000) |
| `NODE_ENV` | No | `development` or `production` |
| `SESSION_SECRET` | Yes | Session encryption secret |
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `GOOGLE_CLIENT_ID` | No | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | No | Google OAuth client secret |
| `DISCORD_CLIENT_ID` | No | Discord OAuth client ID |
| `DISCORD_CLIENT_SECRET` | No | Discord OAuth client secret |

OAuth providers are optional — the server starts without them but logs a warning. The game works fully offline without the server (multiplayer features stay hidden).

### Upgrade types

| Type | Behavior |
|------|----------|
| `passive` | Generates lumens per second continuously |
| `click` | Adds lumens per click |
| `burst` | Periodically spawns lumen bursts on the canvas |
| `victory` | Final upgrade (Sun/Eclipse) — triggers the endgame cinematic |

### Dual-mode system

The game has two complete thematic identities:

- **ON mode**: Dark background, light particles, astronomical naming (Spark, Star, Supernova...), unit = `lm` (lumens)
- **OFF mode**: Light background, dark particles, entropic naming (Whisper, Cinder, Singularity...), unit = `ob` (obscurs), colors are inverted via the `rgb()`/`rgba()` helpers in `utils.js`

### Prestige system

After reaching victory, players can "Cross Over" to switch modes with a permanent multiplier (`1 + level * 0.5`). Prestige data is stored separately in `localStorage` under key `light-prestige`.

### Persistence

- Save key: `lights-on-save` or `lights-off-save` (mode-dependent)
- Mode key: `light-game-mode`
- Prestige key: `light-prestige`
- Multiplayer onboarding key: `light-mp-onboarding` (`connected` | `solo`)
- Auto-saves every 5 seconds
- JSON serialization to localStorage
- Offline earnings: up to 1 hour, at 50% rate, calculated on load

### Service Worker (`sw.js`)

- Cache name: `lights-on-v9`
- Strategy: Network-first with cache fallback
- Caches all static assets (HTML, CSS, all JS modules, icons, manifest)
- Excludes `/api/`, `/auth/`, `/socket.io/` from caching
- Auto-updates: Client checks for SW updates every 60 seconds
- `skipWaiting()` + `clients.claim()` ensures immediate activation

## Development Workflow

### Running locally (frontend only)

Serve the project root with any static HTTP server:

```bash
# Python
python3 -m http.server 8000

# Node (npx)
npx serve .
```

Then open `http://localhost:8000`. Multiplayer features will be hidden (server unreachable).

### Running with multiplayer

Requires PostgreSQL and OAuth credentials:

```bash
# 1. Set up PostgreSQL and create a database
# 2. Copy server/.env.example to server/.env and fill in values
cp server/.env.example server/.env

# 3. Install dependencies
npm install        # runs postinstall which does: cd server && npm install

# 4. Start the server
npm start          # runs: node server/index.js
```

The server serves static files from the project root and handles API/auth/websocket routes. Open `http://localhost:3000`.

For development with auto-restart:

```bash
cd server && npm run dev    # uses node --watch
```

### Testing

There is no automated test suite. Testing is manual:

- Use the in-game **Debug toggle** (bottom of upgrade panel) to enable admin mode
- Use browser DevTools console to inspect/modify state via breakpoints
- Test both ON and OFF modes separately (they have independent save files)
- Test multiplayer by running the server with a PostgreSQL database

### Deploying

- **Railway**: Configured via `railway.json` — uses Railpack builder, starts `node server/index.js`, healthcheck at `/api/online`
- **Heroku**: Configured via `Procfile` — `web: cd server && node index.js`
- Update the `CACHE_NAME` version string in `sw.js` when making changes (currently `'lights-on-v9'`)
- Update the `ASSETS` array in `sw.js` if new files are added
- The Service Worker's `skipWaiting()` + `clients.claim()` ensures immediate activation
- The client auto-reloads when a new SW takes control

## Code Conventions

### JavaScript (frontend — `js/`)

- **ES modules** with `import`/`export` — loaded via `<script type="module">`
- `'use strict'` at the top of every file
- `let`/`const` preferred (`const` for constants and imports, `let` for mutable)
- **camelCase** for variables and functions
- **UPPER_SNAKE_CASE** for constants (`UPGRADES`, `VICTORY_LUMENS`, `SHADOW_THEME`)
- Module header comment: `// === ModuleName — Brief description ===`
- Section delimiters within modules: `// --- Section Name ---`
- No external libraries on the frontend (except Socket.io, loaded from server)
- Protected native references in `utils.js` (`_raf`, `_si`, `_st`, `_now`) to resist tampering

### JavaScript (backend — `server/`)

- **CommonJS** (`require`/`module.exports`) — Node.js without transpilation
- `'use strict'` at the top of every file
- Modern JS syntax (async/await, arrow functions, optional chaining)
- Console logging with prefix tags: `[server]`, `[auth]`, `[db]`, `[api]`, `[socket]`

### CSS

- Monospace font throughout: `'Courier New', Courier, monospace`
- Mobile-first responsive design using `clamp()`, `dvh` units, `safe-area-inset-*`
- CSS animations for UI feedback (pulse, breathe, fade)
- No CSS custom properties — values are inline
- BEM-inspired but flat naming (`#mode-select`, `.mode-half`, `.upgrade-item`)
- Multiplayer UI styles prefixed with `#mp-` (e.g., `#mp-balance`, `#mp-overlay`, `#mp-onboarding`)

### HTML

- Semantic structure with `id`-based element references
- All DOM queries cached at module load time in `dom.js` (or at function scope for multiplayer elements in `main.js`)
- No templating — upgrade list and dynamic UI built programmatically via `document.createElement`

## Key Things to Know When Making Changes

1. **Game logic is split across `js/` modules.** Find modules by their header comment (`// === ModuleName — ...`). The entry point is `js/main.js`.

2. **Color inversion is automatic** in OFF mode — always use the `rgb()`/`rgba()` helpers from `utils.js` for canvas rendering. Never hardcode `rgba(...)` strings directly.

3. **Adding a new upgrade** requires entries in both the `UPGRADES` array and the `SHADOW_THEME` object in `js/upgrades-data.js`. Follow the existing pattern for `id`, `name`, `desc`, costs, and type.

4. **Adding a new visual effect** means creating a file in `js/effects/`, exporting update/draw/reset functions, importing them in `js/game-loop.js` (and `js/victory.js` for reset), and adding the file to the `ASSETS` array in `sw.js`.

5. **Save format** is a flat JSON object in `js/save.js`. Adding new state fields requires updating both `save()` and `load()`, with fallback defaults in `load()`.

6. **Service Worker maintenance**: When adding or renaming files, update both `CACHE_NAME` (bump version) and the `ASSETS` array in `sw.js`. API/auth/socket routes are automatically excluded from caching.

7. **The game UI is in French.** All user-facing strings (upgrade names, descriptions, UI labels, victory text, onboarding text) should be written in French. Upgrade names/descs in `upgrades-data.js` are currently in English but get shadow-themed names in OFF mode.

8. **No build step** means changes are immediately reflected on reload — but remember to bump the SW cache version for production.

9. **Canvas rendering order** matters — the draw order in `js/game-loop.js` determines visual layering (stars at back, pulsar near front, HUD on top).

10. **Touch and mouse events** are both handled in `js/click.js` — any new interactive canvas element needs both `mousedown`/`mousemove`/`mouseup` and `touchstart`/`touchmove`/`touchend` handlers.

11. **Multiplayer is progressive** — it stays completely hidden until the server is reachable AND the player reaches 60K total lumens (the onboarding threshold in `js/onboarding.js`). The game works fully without the server.

12. **Anti-auto-clicker** protection exists in `js/interaction.js`. It detects suspiciously fast/identical clicks and applies a cooldown penalty. Keep this in mind when testing.

13. **Prestige state** is stored separately from game saves. The `state.js` module handles prestige loading on import (runs `loadPrestige()` immediately). Prestige multiplier affects both passive income and offline earnings.

14. **Adding a new API endpoint** requires adding it to `server/index.js`. If it needs database access, add the query function to `server/db.js`. Auth-protected routes should check `req.isAuthenticated()`.

15. **Socket.io** is auto-served by the server at `/socket.io/socket.io.js` — no npm package needed on the frontend. The client script is loaded with `defer` in `index.html`.
