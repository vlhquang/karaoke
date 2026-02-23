import type { QueueSong, RoomMember, RoomSnapshot, RoomState } from "@karaoke/shared";

interface InternalRoom {
  roomCode: string;
  hostSessionId: string;
  createdAt: string;
  nowPlaying: QueueSong | null;
  queue: QueueSong[];
  members: Map<string, RoomMember>;
}

export class InMemoryRoomStore {
  private readonly rooms = new Map<string, InternalRoom>();

  roomExists(roomCode: string): boolean {
    return this.rooms.has(roomCode);
  }

  createRoom(roomCode: string, hostUserId: string, hostDisplayName: string, hostSocketId: string): RoomState {
    if (this.rooms.has(roomCode)) {
      throw new Error("ROOM_CODE_CONFLICT");
    }

    const createdAt = new Date().toISOString();
    const hostMember: RoomMember = {
      userId: hostUserId,
      roomCode,
      displayName: hostDisplayName,
      role: "host",
      socketId: hostSocketId,
      createdAt
    };

    const room: InternalRoom = {
      roomCode,
      hostSessionId: hostUserId,
      createdAt,
      nowPlaying: null,
      queue: [],
      members: new Map([[hostUserId, hostMember]])
    };

    this.rooms.set(roomCode, room);
    return this.toRoomState(room);
  }

  addMember(member: RoomMember): void {
    const room = this.rooms.get(member.roomCode);
    if (!room) {
      throw new Error("ROOM_NOT_FOUND");
    }
    room.members.set(member.userId, member);
  }

  getMember(roomCode: string, userId: string): RoomMember | null {
    const room = this.rooms.get(roomCode);
    if (!room) {
      return null;
    }
    return room.members.get(userId) ?? null;
  }

  getRoomState(roomCode: string): RoomState | null {
    const room = this.rooms.get(roomCode);
    if (!room) {
      return null;
    }
    return this.toRoomState(room);
  }

  getSnapshot(roomCode: string): RoomSnapshot | null {
    const room = this.rooms.get(roomCode);
    if (!room) {
      return null;
    }

    return {
      room: this.toRoomState(room),
      nowPlaying: room.nowPlaying,
      queue: [...room.queue]
    };
  }

  enqueueSong(song: QueueSong, isPriority: boolean): { ok: true } | { ok: false; reason: "PENDING_LIMIT" | "DUPLICATE_VIDEO" | "ROOM_NOT_FOUND" } {
    const room = this.rooms.get(song.roomCode);
    if (!room) {
      return { ok: false, reason: "ROOM_NOT_FOUND" };
    }

    const pendingCount = room.queue.filter((item) => item.addedByUserId === song.addedByUserId).length;
    if (pendingCount >= 2) {
      return { ok: false, reason: "PENDING_LIMIT" };
    }

    const duplicate = room.queue.some((item) => item.addedByUserId === song.addedByUserId && item.videoId === song.videoId);
    if (duplicate) {
      return { ok: false, reason: "DUPLICATE_VIDEO" };
    }

    if (isPriority) {
      room.queue.unshift(song);
    } else {
      room.queue.push(song);
    }

    return { ok: true };
  }

  popNext(roomCode: string): QueueSong | null {
    const room = this.rooms.get(roomCode);
    if (!room) {
      return null;
    }

    const next = room.queue.shift() ?? null;
    room.nowPlaying = next;
    return next;
  }

  clearNowPlaying(roomCode: string): void {
    const room = this.rooms.get(roomCode);
    if (!room) {
      return;
    }
    room.nowPlaying = null;
  }

  removeSong(roomCode: string, songId: string): boolean {
    const room = this.rooms.get(roomCode);
    if (!room) {
      return false;
    }

    const before = room.queue.length;
    room.queue = room.queue.filter((song) => song.id !== songId);
    return room.queue.length < before;
  }

  private toRoomState(room: InternalRoom): RoomState {
    return {
      roomCode: room.roomCode,
      hostSessionId: room.hostSessionId,
      nowPlaying: room.nowPlaying,
      queueLength: room.queue.length,
      createdAt: room.createdAt
    };
  }
}

export const inMemoryRoomStore = new InMemoryRoomStore();
