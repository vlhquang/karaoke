import type { QueueSong } from "@karaoke/shared";
import type { Redis } from "ioredis";
import { redisKeys } from "./keys.js";

const enqueueScript = `
  local roomMetaKey = KEYS[1]
  local queueKey = KEYS[2]
  local pendingCountKey = KEYS[3]
  local pendingVideoSetKey = KEYS[4]

  local songJson = ARGV[1]
  local isPriority = ARGV[2]
  local videoId = ARGV[3]

  if redis.call('EXISTS', roomMetaKey) == 0 then
    return {err = 'ROOM_NOT_FOUND'}
  end

  local pendingCount = tonumber(redis.call('GET', pendingCountKey) or '0')
  if pendingCount >= 2 then
    return {err = 'PENDING_LIMIT'}
  end

  if redis.call('SISMEMBER', pendingVideoSetKey, videoId) == 1 then
    return {err = 'DUPLICATE_VIDEO'}
  end

  if isPriority == '1' then
    redis.call('LPUSH', queueKey, songJson)
  else
    redis.call('RPUSH', queueKey, songJson)
  end

  redis.call('INCR', pendingCountKey)
  redis.call('SADD', pendingVideoSetKey, videoId)
  redis.call('EXPIRE', pendingCountKey, 43200)
  redis.call('EXPIRE', pendingVideoSetKey, 43200)

  return {ok = '1'}
`;

const popNextScript = `
  local queueKey = KEYS[1]
  local nowPlayingKey = KEYS[2]

  local nextSong = redis.call('LPOP', queueKey)
  if not nextSong then
    redis.call('DEL', nowPlayingKey)
    return ''
  end

  local decoded = cjson.decode(nextSong)
  local countKey = 'room:' .. decoded.roomCode .. ':user:' .. decoded.addedByUserId .. ':pending_count'
  local videoSetKey = 'room:' .. decoded.roomCode .. ':user:' .. decoded.addedByUserId .. ':pending_videos'

  redis.call('DECR', countKey)
  if tonumber(redis.call('GET', countKey) or '0') <= 0 then
    redis.call('DEL', countKey)
  end
  redis.call('SREM', videoSetKey, decoded.videoId)

  redis.call('SET', nowPlayingKey, nextSong)
  return nextSong
`;

const removeSongScript = `
  local queueKey = KEYS[1]
  local songId = ARGV[1]

  local items = redis.call('LRANGE', queueKey, 0, -1)
  if #items == 0 then
    return 0
  end

  redis.call('DEL', queueKey)
  local removed = nil

  for i = 1, #items do
    local song = cjson.decode(items[i])
    if song.id == songId and not removed then
      removed = song
    else
      redis.call('RPUSH', queueKey, items[i])
    end
  end

  if removed then
    local countKey = 'room:' .. removed.roomCode .. ':user:' .. removed.addedByUserId .. ':pending_count'
    local pendingVideoSetKey = 'room:' .. removed.roomCode .. ':user:' .. removed.addedByUserId .. ':pending_videos'

    redis.call('DECR', countKey)
    if tonumber(redis.call('GET', countKey) or '0') <= 0 then
      redis.call('DEL', countKey)
    end
    redis.call('SREM', pendingVideoSetKey, removed.videoId)

    return 1
  end

  return 0
`;

export class QueueRepository {
  constructor(private readonly redis: Redis) {}

  async enqueue(song: QueueSong, isPriority: boolean): Promise<{ ok: true } | { ok: false; reason: string }> {
    try {
      await this.redis.eval(enqueueScript, 4,
        redisKeys.roomMeta(song.roomCode),
        redisKeys.roomQueue(song.roomCode),
        redisKeys.pendingCount(song.roomCode, song.addedByUserId),
        redisKeys.pendingVideoSet(song.roomCode, song.addedByUserId),
        JSON.stringify(song),
        isPriority ? "1" : "0",
        song.videoId
      );
      return { ok: true };
    } catch (error) {
      const reason = error instanceof Error ? error.message : "UNKNOWN";
      if (reason.includes("PENDING_LIMIT")) {
        return { ok: false, reason: "PENDING_LIMIT" };
      }
      if (reason.includes("DUPLICATE_VIDEO")) {
        return { ok: false, reason: "DUPLICATE_VIDEO" };
      }
      if (reason.includes("ROOM_NOT_FOUND")) {
        return { ok: false, reason: "ROOM_NOT_FOUND" };
      }
      return { ok: false, reason: "QUEUE_ERROR" };
    }
  }

  async popNext(roomCode: string): Promise<QueueSong | null> {
    const result = await this.redis.eval(popNextScript, 2,
      redisKeys.roomQueue(roomCode),
      redisKeys.roomNowPlaying(roomCode)
    );

    if (typeof result !== "string" || result.length === 0) {
      return null;
    }

    return JSON.parse(result) as QueueSong;
  }

  async removeSong(roomCode: string, songId: string): Promise<boolean> {
    const removed = await this.redis.eval(removeSongScript, 1, redisKeys.roomQueue(roomCode), songId);
    return Number(removed) === 1;
  }
}
