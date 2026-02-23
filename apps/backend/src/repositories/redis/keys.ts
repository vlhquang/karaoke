export const redisKeys = {
  roomMeta: (roomCode: string) => `room:${roomCode}:meta`,
  roomQueue: (roomCode: string) => `room:${roomCode}:queue`,
  roomNowPlaying: (roomCode: string) => `room:${roomCode}:now_playing`,
  roomMembers: (roomCode: string) => `room:${roomCode}:members`,
  pendingCount: (roomCode: string, userId: string) => `room:${roomCode}:user:${userId}:pending_count`,
  pendingVideoSet: (roomCode: string, userId: string) => `room:${roomCode}:user:${userId}:pending_videos`
};
