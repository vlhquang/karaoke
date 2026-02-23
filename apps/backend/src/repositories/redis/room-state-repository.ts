import type { RoomMember, RoomSnapshot, RoomState } from "@karaoke/shared";
import type { Redis } from "ioredis";
import { redisKeys } from "./keys.js";

export class RoomStateRepository {
  constructor(private readonly redis: Redis) {}

  async roomExists(roomCode: string): Promise<boolean> {
    const exists = await this.redis.exists(redisKeys.roomMeta(roomCode));
    return exists === 1;
  }

  async createRoom(roomCode: string, hostUserId: string, hostDisplayName: string, hostSocketId: string): Promise<RoomState> {
    const createdAt = new Date().toISOString();
    const roomMetaKey = redisKeys.roomMeta(roomCode);
    const membersKey = redisKeys.roomMembers(roomCode);
    const createRoomScript = `
      if redis.call('EXISTS', KEYS[1]) == 1 then
        return 0
      end

      redis.call('HSET', KEYS[1], 'roomCode', ARGV[1], 'hostSessionId', ARGV[2], 'createdAt', ARGV[3])
      redis.call('HSET', KEYS[2], ARGV[2], ARGV[4])
      redis.call('EXPIRE', KEYS[1], 43200)
      redis.call('EXPIRE', KEYS[2], 43200)
      return 1
    `;

    const hostMemberJson = JSON.stringify({
      userId: hostUserId,
      roomCode,
      displayName: hostDisplayName,
      role: "host",
      socketId: hostSocketId,
      createdAt
    });

    const created = Number(
      await this.redis.eval(createRoomScript, 2, roomMetaKey, membersKey, roomCode, hostUserId, createdAt, hostMemberJson)
    );

    if (created !== 1) {
      throw new Error("ROOM_CODE_CONFLICT");
    }

    return {
      roomCode,
      hostSessionId: hostUserId,
      createdAt,
      queueLength: 0,
      nowPlaying: null
    };
  }

  async addMember(member: RoomMember): Promise<void> {
    await this.redis.hset(redisKeys.roomMembers(member.roomCode), member.userId, JSON.stringify(member));
  }

  async getMember(roomCode: string, userId: string): Promise<RoomMember | null> {
    const raw = await this.redis.hget(redisKeys.roomMembers(roomCode), userId);
    if (!raw) {
      return null;
    }
    return JSON.parse(raw) as RoomMember;
  }

  async getRoomState(roomCode: string): Promise<RoomState | null> {
    const meta = await this.redis.hgetall(redisKeys.roomMeta(roomCode));
    if (!meta.roomCode) {
      return null;
    }

    const nowPlayingRaw = await this.redis.get(redisKeys.roomNowPlaying(roomCode));
    const queueLength = await this.redis.llen(redisKeys.roomQueue(roomCode));

    return {
      roomCode: meta.roomCode,
      hostSessionId: meta.hostSessionId,
      createdAt: meta.createdAt,
      queueLength,
      nowPlaying: nowPlayingRaw ? JSON.parse(nowPlayingRaw) : null
    };
  }

  async getSnapshot(roomCode: string): Promise<RoomSnapshot | null> {
    const room = await this.getRoomState(roomCode);
    if (!room) {
      return null;
    }

    const [queueRaw, nowPlayingRaw] = await Promise.all([
      this.redis.lrange(redisKeys.roomQueue(roomCode), 0, -1),
      this.redis.get(redisKeys.roomNowPlaying(roomCode))
    ]);

    return {
      room,
      nowPlaying: nowPlayingRaw ? JSON.parse(nowPlayingRaw) : null,
      queue: queueRaw.map((item) => JSON.parse(item))
    };
  }
}
