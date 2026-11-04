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

## Portal UI

The portal uses a shared light Liquid Glass theme across its Next.js apps and standalone HTML pages. See [the design analysis and implementation notes](docs/portal-liquid-glass.md) for coverage, architecture and validation. Run `npm run test:portal -w @karaoke/frontend` for navigation, search and saved-app checks.

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

# News notifications to Microsoft Teams

The frontend Node server polls RSS feeds and posts new articles to a Teams channel. It is disabled until `NEWS_TEAMS_WEBHOOK_URL` is configured.

1. In Teams, create an **Incoming Webhook** (or a Workflows webhook that accepts Adaptive Cards) for the target channel and copy its URL.
2. Set `NEWS_TEAMS_WEBHOOK_URL` in the server environment. For Render, add it to the service environment variables; `render.yaml` declares it as a secret field.
3. Optionally set `NEWS_RSS_URLS` to comma-separated RSS URLs. When left blank, the worker scans Vietnam technology/AI/cybersecurity, Vietnam digital banking/fintech/Java, then global cybersecurity/AI/banking/Java feeds, in that order.
4. Set `NEWS_POLL_INTERVAL_MINUTES` to any positive number of minutes, such as `1`, `5`, or `15`. The default is `5`.

The first successful scan records the current feed items as a baseline. Later scans post only items with a valid publication date newer than the previous successful scan, and skip items without a readable date. Seen IDs and the scan timestamp are kept in process memory, so a server restart starts a fresh baseline. The worker runs in the web server process; use an always-on instance for reliable polling at short intervals.
