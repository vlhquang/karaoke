import type { RoomMember, RoomSnapshot, RoomState } from "@karaoke/shared";
import { v4 as uuidv4 } from "uuid";
import { generateRoomCode } from "../utils/room-code.js";
import { AppError } from "../utils/errors.js";
import { inMemoryRoomStore } from "./in-memory-room-store.js";

export class RoomService {
  async createRoom(displayName: string, socketId: string): Promise<{ roomCode: string; member: RoomMember; snapshot: RoomSnapshot }> {
    const hostUserId = uuidv4();
    let roomCode = "";
    let roomState: RoomState | null = null;

    for (let i = 0; i < 8; i += 1) {
      const candidate = generateRoomCode();
      try {
        roomState = inMemoryRoomStore.createRoom(candidate, hostUserId, displayName, socketId);
        roomCode = candidate;
        break;
      } catch (error) {
        if (!(error instanceof Error) || error.message !== "ROOM_CODE_CONFLICT") {
          throw error;
        }
      }
    }

    if (!roomState || !roomCode) {
      throw new AppError("Failed to allocate room code", "ROOM_CODE_CONFLICT", 500);
    }

    const member: RoomMember = {
      userId: hostUserId,
      roomCode,
      displayName,
      role: "host",
      socketId,
      createdAt: roomState.createdAt
    };

    return {
      roomCode,
      member,
      snapshot: {
        room: roomState,
        nowPlaying: null,
        queue: []
      }
    };
  }

  async joinRoom(roomCode: string, displayName: string, socketId: string): Promise<{ member: RoomMember; snapshot: RoomSnapshot }> {
    const roomState = inMemoryRoomStore.getRoomState(roomCode);
    if (!roomState) {
      throw new AppError("Room not found", "ROOM_NOT_FOUND", 404);
    }

    const member: RoomMember = {
      userId: uuidv4(),
      roomCode,
      displayName,
      role: "guest",
      socketId,
      createdAt: new Date().toISOString()
    };

    inMemoryRoomStore.addMember(member);

    const snapshot = inMemoryRoomStore.getSnapshot(roomCode);
    if (!snapshot) {
      throw new AppError("Room not found", "ROOM_NOT_FOUND", 404);
    }

    return { member, snapshot };
  }

  async getSnapshot(roomCode: string): Promise<RoomSnapshot> {
    const snapshot = inMemoryRoomStore.getSnapshot(roomCode);
    if (!snapshot) {
      throw new AppError("Room not found", "ROOM_NOT_FOUND", 404);
    }
    return snapshot;
  }

  async assertHost(roomCode: string, userId: string): Promise<void> {
    const member = inMemoryRoomStore.getMember(roomCode, userId);
    if (!member || member.role !== "host") {
      throw new AppError("Only host can perform this action", "FORBIDDEN", 403);
    }
  }
}
