# Realtime Karaoke Room (Single App)

Realtime karaoke app runs as one Next.js service:
- UI pages
- Socket.IO realtime room/queue
- YouTube search API route
- In-memory room state (no Redis/SQL)

## Quick Start

1. Copy env:
   - `cp .env.example .env`
2. Fill `YOUTUBE_API_KEY`.
3. Install deps:
   - `npm install`
4. Run app:
   - `npm run dev`
5. Open:
   - `http://localhost:3000`

## Important Notes

- In-memory mode supports realtime multi-device while the process is running.
- Restarting app clears all rooms and queues.

## Docker

- Dev: `docker compose up --build`
- Prod-style: `docker compose -f docker-compose.prod.yml up --build -d`

## Deploy Render

Project already includes `render.yaml` for Blueprint deploy.

1. Push source code to GitHub/GitLab.
2. In Render, create service from Blueprint (`render.yaml`).
3. Set required env vars in Render dashboard:
   - `YOUTUBE_API_KEY`
   - `NEXT_PUBLIC_APP_ORIGIN=https://<your-service>.onrender.com`
4. Deploy.

Notes:
- Keep one instance only for in-memory room mode.
- Service restart/sleep will reset all rooms and queues.
