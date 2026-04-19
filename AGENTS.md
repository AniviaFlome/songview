# AGENTS.md

## Project overview

Vanilla HTML/CSS/JS CSV viewer with no build step. ES modules served statically. Supports Spotify (Exportify) and osu! (beatmap-manager) CSV formats. Deployed on Cloudflare Pages with D1 for the share feature.

## Commands

```bash
# Dev server (required — ES modules won't work on file://)
python3 -m http.server 8000
# or
npx serve .

# Cloudflare Pages dev (with D1 backend)
npx wrangler pages dev .

# Format all code (nixfmt + prettier + biome)
nix fmt

# Lint only
npx biome check .

# Deploy
npx wrangler pages deploy .

# D1 setup
npx wrangler d1 create song-view-db
npx wrangler d1 execute song-view-db --local --file=./migrations/0000_initial.sql
npx wrangler d1 execute song-view-db --remote --file=./migrations/0000_initial.sql
```

## Architecture

- `app.js` — single entrypoint, calls `init()` on DOMContentLoaded
- `js/main.js` — event listeners, init, share, URL param restore
- `js/data.js` — CSV parsing, format detection (`isOsuKeys`), `transformOsuData`, `handleSort`
- `js/ui.js` — all rendering: table, grid, modal, stats, share modal
- `js/state.js` — single mutable global state object (no framework)
- `js/dom.js` — DOM element references (all queried by ID at module load)
- `js/utils.js` — `escapeHtml`, `formatDuration`, `formatTrackDuration`, `parseCSVLine`, `parseLengthToSeconds`
- `js/api.js` — Cloudflare D1 share API client
- `js/themes.js` — theme switching; sets `window.setTheme` globally for inline onclick handlers
- `css/styles.css` — root `@import` for `base.css`, `layout.css`, `components.css`, `css/themes/index.css`

**Circular dependency:** `data.js` ↔ `ui.js` — works due to ES module live bindings but be aware.

## Key conventions

- **No bundler** — all JS ships as-is. Paths use `.js` extensions in imports.
- **CSV format detection** — `isOsuKeys()` checks for `BeatmapSetID`, `Difficulty`, `MD5` in headers. osu! rows are grouped by BeatmapSetID with difficulties as `"name::stars||name::stars"` in the `Difficulties` field.
- **Theme system** — 12 themes under `css/themes/<id>.css` using `[data-theme="<id>"]` selectors. Cookie-first persistence, localStorage fallback. Default is `dark`.
- **Cloudflare Pages Functions** — `functions/` uses file-based routing. `[id].js` = dynamic param. Exports are named (`onRequestPost`, `onRequestGet`), not default.
- **D1 schema** — `shares` table: `id TEXT PK`, `data TEXT NOT NULL` (JSON string), `created_at INTEGER DEFAULT (unixepoch())`.

## Formatting

`biome.json` disables: `useLiteralKeys`, `useTemplate`, `noDescendingSpecificity`, `noDocumentCookie`. Some `!important` in CSS is intentional (`.hidden`, play-overlay transitions). `flake.nix` is excluded from treefmt via `settings.global.excludes`.
