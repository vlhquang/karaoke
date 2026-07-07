# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Development
npm run dev          # Start the frontend (Next.js + custom Express server) at localhost:3000
npm run build        # Build shared package then Next.js frontend
npm run lint         # ESLint for frontend
npm run typecheck    # Type-check frontend (builds shared first)

# Per-workspace commands
npm run dev -w @karaoke/frontend
npm run build -w @karaoke/shared
npm run typecheck -w @karaoke/backend

# Docker
docker compose up --build                              # Dev
docker compose -f docker-compose.prod.yml up --build -d  # Prod-style
```

## Architecture

This is an npm workspaces monorepo with three packages:
- `apps/frontend` (`@karaoke/frontend`) — the single deployable service: Next.js 15 app + custom Express/Socket.IO server
- `apps/backend` (`@karaoke/backend`) — standalone Express/Socket.IO server (currently superseded by frontend's integrated server)
- `packages/shared` (`@karaoke/shared`) — shared TypeScript types for Socket.IO events and room data; **must be built before frontend**

### The Server Entry Point

`apps/frontend/server.ts` is the real entry point (not `next start`). It:
1. Creates an Express app and HTTP server
2. Mounts the Next.js request handler as a catch-all route
3. Attaches Socket.IO on the same HTTP server
4. Registers feature namespaces: `/lixi` (lì xì), `/co-ty-phu`, `/fitness-game`, and GPS tracker
5. Keeps all room state in-memory — restarting the process clears everything

`npm run dev` runs `tsx server.ts`; production uses the compiled `dist/server.js`.

### Feature Areas (frontend src)

Each feature lives under `src/<feature-name>/` with components and lib, and has a Next.js route under `src/app/<feature-name>/`:

| Directory | Description |
|-----------|-------------|
| `chi-tieu/` | Personal expense tracker — Google Sheets backend via Apps Script proxy |
| `co-ty-phu/` | Vietnamese Monopoly board game (realtime, Socket.IO namespace `/co-ty-phu`) |
| `li-xi-nang-cao/` | Advanced lucky money game (Socket.IO namespace `/lixi`) |
| `fitness-game/` | Fitness mini-game with camera (Socket.IO namespace `/fitness-game`) |
| `camera-dodge/` | Camera-based dodge game using MediaPipe |
| `khoi-chase/` | Chase mini-game |
| `game-hub/` | 3D multiplayer game hub |
| `gps-tracker/` | Realtime GPS location sharing |
| `co-phieu/` | Stock portfolio tracker (Google Sheets) |
| `xem-phim/` | Movie download/streaming (yt-dlp + Google Drive) |

Karaoke, Lô Tô, and Racing Game room logic lives directly in `server.ts` (not in feature subdirectories).

### State Management Pattern

Client state uses **Zustand** stores under `src/store/`. The chi-tieu store is representative: it caches data in `localStorage`, proxies all mutations through `/api/chi-tieu` (a Next.js API route that forwards to Google Apps Script), and exposes typed actions.

### API Routes

Next.js API routes at `src/app/api/` are thin server-side proxies:
- `/api/chi-tieu` → Google Apps Script (expense tracker backend)
- `/api/stocks/` → stock data
- `/api/movies/` → movie download/streaming
- `/api/youtube/` → YouTube search

### Socket.IO Architecture

The main Socket.IO server (`io`) handles Karaoke rooms and Lô Tô on the default namespace with `snake_case` event names. Feature namespaces use separate registration functions:
- `registerLiXiNamespace(io.of("/lixi"), ...)` 
- `registerCoTyPhuNamespace(io.of("/co-ty-phu"))`
- `registerFitnessGameNamespace(io.of("/fitness-game"))`

Racing game events use `kebab-case` event names and are registered directly on the main socket in `server.ts`.

### External Services / Env Vars

| Env Var | Purpose |
|---------|---------|
| `YOUTUBE_API_KEY` | YouTube Data API for song search |
| `NEXT_PUBLIC_APP_ORIGIN` | Public URL (used for keep-alive ping) |
| `CHITIEU_APPS_SCRIPT_URL` | Google Apps Script deployment URL for chi-tieu |
| `GOOGLE_OAUTH_CLIENT_ID/SECRET` | OAuth for Google Drive integration |
| `GOOGLE_REFRESH_TOKEN` | Google Drive access |
| `GOOGLE_DRIVE_FOLDER_ID` | Drive folder for movie storage |

### Deployment

Deployed to Render via `render.yaml` (single web service, free plan). The keep-alive worker in `src/lib/keep-alive.ts` pings the service every 14 minutes to prevent sleep. Only one instance should run to preserve in-memory room state.

The `racing-game/` directory at the repo root is a separate Phaser.js game served as static files; it is loaded at runtime by `server.ts` from a relative path.
