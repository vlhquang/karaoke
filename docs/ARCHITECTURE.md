# Architecture (Single Service)

## Runtime

- One Next.js process on port `3000`.
- Same service handles:
  - UI routes (`/host`, `/join`, `/room/[code]`)
  - API routes (`/api/youtube/search`, `/health`)
  - Socket.IO realtime (`/socket.io`)

## State

- In-memory room map in `apps/frontend/server.ts`.
- Queue rules:
  - max 2 pending songs per user
  - duplicate pending song by same user is blocked
  - only host can skip/remove song

## Tradeoff

- Simple deployment and no service split.
- Restarting process clears all rooms and queues.
