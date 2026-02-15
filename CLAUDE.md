# CLAUDE.md — AI Assistant Guide for Lights-on

## Project Overview

**Light** is a progressive web app (PWA) incremental/clicker game with a philosophical dual-mode design. Players choose between "Lights ON" (bringing light to darkness) or "Lights OFF" (bringing darkness to light), then accumulate lumens (or "obscurs" in OFF mode) through clicking and upgrades to reach 1 trillion units and trigger a victory condition.

- **Language**: French (all user-facing text is in French)
- **Tech stack**: Vanilla HTML/CSS/JavaScript — zero external dependencies
- **No build system**: No bundler, no transpiler, no package manager. Files are served directly.

## File Structure

```
/
├── index.html          # Entry point — HTML structure, PWA meta tags, SW registration
├── game.js             # All game logic (~3,670 lines, single IIFE)
├── style.css           # All styling (~770 lines)
├── sw.js               # Service Worker — network-first caching strategy
├── manifest.json       # PWA manifest (standalone, portrait, black theme)
├── README.md           # Minimal project readme
├── CLAUDE.md           # This file
└── icons/
    ├── icon.svg         # 512x512 app icon
    └── icon-192.svg     # 192x192 app icon
```

## Architecture

### Single-file game engine (`game.js`)

The entire game is contained in a single IIFE with `'use strict'`. Major sections (in order):

1. **Mode Selection** (lines ~11–75) — Landing page logic, saved game detection
2. **State** (lines ~77–92) — Core game state object: `lumens`, `totalLumens`, `clickPower`, `lumensPerSecond`, `upgrades`, `victoryReached`, `sunPurchased`
3. **Constants** — `VICTORY_LUMENS = 1,000,000,000,000` (1 trillion)
4. **Color helpers** — `rgb()` / `rgba()` that auto-invert colors in OFF mode
5. **Upgrades Definition** (`UPGRADES` array, 24 upgrades + victory item) — Each has: `id`, `name`, `desc`, `baseCost`, `costMultiplier`, `type`, `value`, `maxCount`, `unlockAt`
6. **Shadow Theme** (`SHADOW_THEME` object) — Alternative names/descriptions for every upgrade in OFF mode
7. **Visual Systems** — Stars, Constellations, Pulsar, Prism Rays, Lightning Bolts, Light Bursts, Halos, Big Bang, Black Hole
8. **Upgrade Panel & UI** — DOM manipulation for the upgrade sidebar
9. **Click Handling** — Canvas click/touch events, lumen accumulation
10. **Passive Income** — Tick-based income (10 ticks/second)
11. **Save/Load** — localStorage persistence with separate keys per mode
12. **Game Loop** — `requestAnimationFrame` at native refresh rate
13. **Intro Animation** — New-game cinematic overlay

### Upgrade types

| Type | Behavior |
|------|----------|
| `passive` | Generates lumens per second continuously |
| `click` | Adds lumens per click |
| `burst` | Periodically spawns lumen bursts on the canvas |
| `victory` | Final upgrade (Sun/Eclipse) — triggers the endgame light switch |

### Dual-mode system

The game has two complete thematic identities:

- **ON mode**: Dark background, light particles, astronomical naming (Etincelle, Etoile, Supernova...), unit = `lm` (lumens)
- **OFF mode**: Light background, dark particles, entropic naming (Murmure, Cendre, Singularite...), unit = `ob` (obscurs), colors are inverted via the `rgb()`/`rgba()` helpers

### Persistence

- Save key: `lights-on-save` or `lights-off-save` (mode-dependent)
- Mode key: `light-game-mode`
- Auto-saves every 5 seconds
- JSON serialization to localStorage

### Service Worker (`sw.js`)

- Cache name: `lights-on-v3`
- Strategy: Network-first with cache fallback
- Caches: HTML, CSS, JS, manifest, icons
- Auto-updates: Client checks for SW updates every 60 seconds

## Development Workflow

### Running locally

Serve the project root with any static HTTP server:

```bash
# Python
python3 -m http.server 8000

# Node (npx)
npx serve .
```

Then open `http://localhost:8000` in a browser.

### Testing

There is no automated test suite. Testing is manual:

- Use the in-game **Debug toggle** (bottom of upgrade panel) to enable admin mode
- Use browser DevTools console to inspect/modify `state` (not directly accessible due to IIFE — use breakpoints or the admin mode)
- Test both ON and OFF modes separately (they have independent save files)

### Deploying

- Update the `CACHE_NAME` version string in `sw.js` when making changes (currently `'lights-on-v3'`)
- The Service Worker's `skipWaiting()` + `clients.claim()` ensures immediate activation
- The client auto-reloads when a new SW takes control

## Code Conventions

### JavaScript

- **ES5-compatible** syntax inside an IIFE — no modules, no classes, no arrow functions in game.js
- `'use strict'` mode
- `var`/`let`/`const` mixed usage (prefer `const` for constants, `let` for mutable)
- **camelCase** for variables and functions
- **UPPER_SNAKE_CASE** for constants (`UPGRADES`, `VICTORY_LUMENS`, `SHADOW_THEME`, `CONSTELLATION_TEMPLATES`)
- Section delimiters: `// --- Section Name ---`
- No external libraries — everything is hand-written

### CSS

- Monospace font throughout: `'Courier New', Courier, monospace`
- Mobile-first responsive design using `clamp()`, `dvh` units, `safe-area-inset-*`
- CSS animations for UI feedback (pulse, breathe, fade)
- No CSS custom properties — values are inline
- BEM-inspired but flat naming (`#mode-select`, `.mode-half`, `.upgrade-item`)

### HTML

- Semantic structure with `id`-based element references
- All DOM queries happen at module initialization (top of IIFE)
- No templating — upgrade list is built programmatically via `document.createElement`

## Key Things to Know When Making Changes

1. **All game logic is in one file** (`game.js`). Locate sections via the `// ---` comment headers.
2. **Color inversion is automatic** in OFF mode — always use the `rgb()`/`rgba()` helpers for canvas rendering, never hardcode `rgba(...)` strings directly.
3. **Adding a new upgrade** requires entries in both `UPGRADES` array and `SHADOW_THEME` object. Follow the existing pattern for `id`, `name`, `desc`, costs, and type.
4. **Visual effects** are tied to specific upgrade IDs (e.g., stars → `'star'`, constellations → `'constellation'`, pulsar → `'pulsar'`). Adding a visual system means wiring it into the game loop's update and draw sequences.
5. **Save format** is a flat JSON object. Adding new state fields requires updating both `save()` and `load()` functions, with fallback defaults in `load()`.
6. **Service Worker cache version** (`CACHE_NAME` in `sw.js`) must be bumped when deploying changes, otherwise users may see stale cached files.
7. **The game is entirely in French**. All user-facing strings (upgrade names, descriptions, UI labels, victory text) should be written in French.
8. **No build step** means changes are immediately reflected on reload — but remember to bump the SW cache version for production.
9. **Canvas rendering order** matters — the draw order in `gameLoop()` determines visual layering (stars at back, pulsar at front).
10. **Touch and mouse events** are both handled — any new interactive element needs both `mousedown`/`mousemove`/`mouseup` and `touchstart`/`touchmove`/`touchend` handlers.
