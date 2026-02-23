# Redis Key Schema

- `room:{roomCode}:meta` (HASH)
  - `roomCode`
  - `hostSessionId`
  - `createdAt`

- `room:{roomCode}:members` (HASH)
  - field: `{userId}`
  - value: serialized `RoomMember`

- `room:{roomCode}:queue` (LIST)
  - serialized `QueueSong` values
  - LPUSH for priority song, RPUSH for regular song

- `room:{roomCode}:now_playing` (STRING)
  - serialized `QueueSong`

- `room:{roomCode}:user:{userId}:pending_count` (STRING integer)
  - pending queue count for one user
  - capped at `2`

- `room:{roomCode}:user:{userId}:pending_videos` (SET)
  - `videoId` entries to prevent duplicate spam per user

TTL strategy:
- room metadata and user pending keys expire in 12 hours to clean idle rooms.
