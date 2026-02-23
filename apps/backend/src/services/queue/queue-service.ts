import type { QueueSong } from "@karaoke/shared";
import { v4 as uuidv4 } from "uuid";
import { AppError } from "../../utils/errors.js";
import { inMemoryRoomStore } from "../in-memory-room-store.js";

export class QueueService {
  async addSong(input: {
    roomCode: string;
    videoId: string;
    title: string;
    thumbnailUrl: string;
    duration: string;
    userId: string;
    displayName: string;
    isPriority: boolean;
  }): Promise<void> {
    const song: QueueSong = {
      id: uuidv4(),
      roomCode: input.roomCode,
      videoId: input.videoId,
      title: input.title,
      thumbnailUrl: input.thumbnailUrl,
      duration: input.duration,
      addedByUserId: input.userId,
      addedByName: input.displayName,
      isPriority: input.isPriority,
      createdAt: new Date().toISOString()
    };

    const result = inMemoryRoomStore.enqueueSong(song, input.isPriority);
    if (!result.ok) {
      if (result.reason === "PENDING_LIMIT") {
        throw new AppError("You can only have 2 pending songs", "PENDING_LIMIT", 400);
      }
      if (result.reason === "DUPLICATE_VIDEO") {
        throw new AppError("Duplicate song from same user is not allowed", "DUPLICATE_VIDEO", 400);
      }
      if (result.reason === "ROOM_NOT_FOUND") {
        throw new AppError("Room not found", "ROOM_NOT_FOUND", 404);
      }
      throw new AppError("Failed to queue song", "QUEUE_ERROR", 500);
    }
  }

  async ensureNowPlaying(roomCode: string): Promise<QueueSong | null> {
    const snapshot = inMemoryRoomStore.getSnapshot(roomCode);
    if (!snapshot) {
      throw new AppError("Room not found", "ROOM_NOT_FOUND", 404);
    }
    if (snapshot.nowPlaying) {
      return snapshot.nowPlaying;
    }
    if (snapshot.queue.length === 0) {
      return null;
    }

    const nextSong = inMemoryRoomStore.popNext(roomCode);
    return nextSong;
  }

  async skipSong(roomCode: string): Promise<QueueSong | null> {
    return inMemoryRoomStore.popNext(roomCode);
  }

  async autoAdvance(roomCode: string): Promise<QueueSong | null> {
    return inMemoryRoomStore.popNext(roomCode);
  }

  async removeSong(roomCode: string, songId: string): Promise<void> {
    const removed = inMemoryRoomStore.removeSong(roomCode, songId);
    if (!removed) {
      throw new AppError("Song not found in queue", "SONG_NOT_FOUND", 404);
    }
  }
}
