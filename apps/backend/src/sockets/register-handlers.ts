import type { Server, Socket } from "socket.io";
import type { ClientToServerEvents, ServerToClientEvents } from "@karaoke/shared";
import { createRoomSchema, joinRoomSchema, addSongSchema, removeSongSchema, skipSongSchema } from "../validators/room-validator.js";
import { RoomService } from "../services/room-service.js";
import { QueueService } from "../services/queue/queue-service.js";
import { AppError } from "../utils/errors.js";
import { SocketRateLimiter } from "../services/socket-rate-limiter.js";
import { hudService } from "../services/hud-service.js";

interface SocketUserContext {
  userId: string;
  roomCode: string;
  displayName: string;
  role: "host" | "guest";
}

type KaraokeSocket = Socket<ClientToServerEvents, ServerToClientEvents, Record<string, never>, { user?: SocketUserContext }>;

const toAckError = (error: unknown): { ok: false; message: string } => {
  if (error instanceof AppError) {
    return { ok: false, message: error.message };
  }
  if (error instanceof Error) {
    return { ok: false, message: error.message };
  }
  return { ok: false, message: "Unknown error" };
};

export const registerHandlers = (
  io: Server<ClientToServerEvents, ServerToClientEvents>,
  socket: KaraokeSocket,
  roomService: RoomService,
  queueService: QueueService,
  socketRateLimiter: SocketRateLimiter
): void => {
  const guardRateLimit = async (eventKey: string): Promise<void> => {
    const allowed = await socketRateLimiter.consume(`${socket.id}:${eventKey}`);
    if (!allowed) {
      throw new AppError("Rate limit exceeded", "RATE_LIMITED", 429);
    }
  };

  const broadcastRoomState = async (roomCode: string): Promise<void> => {
    const snapshot = await roomService.getSnapshot(roomCode);
    io.to(roomCode).emit("queue_updated", snapshot);
    io.to(roomCode).emit("now_playing", snapshot.nowPlaying);
  };

  socket.on("create_room", async (payload, ack) => {
    try {
      await guardRateLimit("create_room");
      const parsed = createRoomSchema.parse(payload);
      const { roomCode, member, snapshot } = await roomService.createRoom(parsed.displayName, socket.id);
      socket.join(roomCode);
      socket.data.user = {
        userId: member.userId,
        roomCode,
        displayName: member.displayName,
        role: "host"
      };

      socket.emit("room_created", snapshot);
      ack({ ok: true, roomCode, userId: member.userId });
    } catch (error) {
      ack(toAckError(error));
      socket.emit("error", { message: toAckError(error).message, code: "CREATE_ROOM_ERROR" });
    }
  });

  socket.on("join_room", async (payload, ack) => {
    try {
      await guardRateLimit("join_room");
      const parsed = joinRoomSchema.parse(payload);
      const { member, snapshot } = await roomService.joinRoom(parsed.roomCode, parsed.displayName, socket.id);
      socket.join(parsed.roomCode);
      socket.data.user = {
        userId: member.userId,
        roomCode: parsed.roomCode,
        displayName: member.displayName,
        role: "guest"
      };

      socket.emit("room_joined", snapshot);
      io.to(parsed.roomCode).emit("queue_updated", snapshot);
      ack({ ok: true, roomCode: parsed.roomCode, userId: member.userId });
    } catch (error) {
      ack(toAckError(error));
      socket.emit("error", { message: toAckError(error).message, code: "JOIN_ROOM_ERROR" });
    }
  });

  socket.on("add_song", async (payload, ack) => {
    try {
      await guardRateLimit("add_song");
      const user = socket.data.user;
      if (!user) {
        throw new AppError("Join room first", "UNAUTHORIZED", 401);
      }
      const parsed = addSongSchema.parse(payload);
      if (parsed.roomCode !== user.roomCode) {
        throw new AppError("Invalid room context", "INVALID_ROOM_CONTEXT", 403);
      }

      await queueService.addSong({
        ...parsed,
        userId: user.userId,
        displayName: user.displayName,
        isPriority: false
      });
      await queueService.ensureNowPlaying(parsed.roomCode);

      await broadcastRoomState(parsed.roomCode);
      ack({ ok: true });
    } catch (error) {
      ack(toAckError(error));
      socket.emit("error", { message: toAckError(error).message, code: "ADD_SONG_ERROR" });
    }
  });

  socket.on("add_priority_song", async (payload, ack) => {
    try {
      await guardRateLimit("add_priority_song");
      const user = socket.data.user;
      if (!user) {
        throw new AppError("Join room first", "UNAUTHORIZED", 401);
      }
      const parsed = addSongSchema.parse(payload);
      if (parsed.roomCode !== user.roomCode) {
        throw new AppError("Invalid room context", "INVALID_ROOM_CONTEXT", 403);
      }

      await queueService.addSong({
        ...parsed,
        userId: user.userId,
        displayName: user.displayName,
        isPriority: true
      });
      await queueService.ensureNowPlaying(parsed.roomCode);

      await broadcastRoomState(parsed.roomCode);
      ack({ ok: true });
    } catch (error) {
      ack(toAckError(error));
      socket.emit("error", { message: toAckError(error).message, code: "ADD_PRIORITY_SONG_ERROR" });
    }
  });

  socket.on("skip_song", async (payload, ack) => {
    try {
      await guardRateLimit("skip_song");
      const user = socket.data.user;
      if (!user) {
        throw new AppError("Join room first", "UNAUTHORIZED", 401);
      }
      const parsed = skipSongSchema.parse(payload);
      if (parsed.roomCode !== user.roomCode) {
        throw new AppError("Invalid room context", "INVALID_ROOM_CONTEXT", 403);
      }
      await roomService.assertHost(parsed.roomCode, user.userId);
      if (parsed.reason === "ended") {
        await queueService.autoAdvance(parsed.roomCode);
      } else {
        await queueService.skipSong(parsed.roomCode);
      }
      await broadcastRoomState(parsed.roomCode);
      ack({ ok: true });
    } catch (error) {
      ack(toAckError(error));
      socket.emit("error", { message: toAckError(error).message, code: "SKIP_SONG_ERROR" });
    }
  });

  socket.on("remove_song", async (payload, ack) => {
    try {
      await guardRateLimit("remove_song");
      const user = socket.data.user;
      if (!user) {
        throw new AppError("Join room first", "UNAUTHORIZED", 401);
      }
      const parsed = removeSongSchema.parse(payload);
      if (parsed.roomCode !== user.roomCode) {
        throw new AppError("Invalid room context", "INVALID_ROOM_CONTEXT", 403);
      }
      await roomService.assertHost(parsed.roomCode, user.userId);
      await queueService.removeSong(parsed.roomCode, parsed.songId);
      await broadcastRoomState(parsed.roomCode);
      ack({ ok: true });
    } catch (error) {
      ack(toAckError(error));
      socket.emit("error", { message: toAckError(error).message, code: "REMOVE_SONG_ERROR" });
    }
  });

  // Host can emit skip_song when YouTube player reaches ended state.

  // ── HUD Remote Control Handlers ──

  socket.on("hud_create_room" as any, (ack: any) => {
    try {
      const { roomCode, state } = hudService.createRoom();
      socket.join(`hud:${roomCode}`);
      ack({ ok: true, roomCode, state });
    } catch (error) {
      ack({ ok: false, message: error instanceof Error ? error.message : "Unknown error" });
    }
  });

  socket.on("hud_join_room" as any, (payload: { roomCode: string }, ack: any) => {
    try {
      const room = hudService.getRoom(payload.roomCode);
      if (!room) {
        ack({ ok: false, message: "Không tìm thấy phòng HUD. Kiểm tra lại mã phòng." });
        return;
      }
      socket.join(`hud:${room.roomCode}`);
      ack({ ok: true, state: room.state });
    } catch (error) {
      ack({ ok: false, message: error instanceof Error ? error.message : "Unknown error" });
    }
  });

  socket.on("hud_update_state" as any, (payload: { roomCode: string; state: any }, ack: any) => {
    try {
      const newState = hudService.updateState(payload.roomCode, payload.state);
      if (!newState) {
        ack({ ok: false, message: "Phòng HUD không tồn tại." });
        return;
      }
      // Broadcast to all devices in this HUD room (excluding sender)
      socket.to(`hud:${payload.roomCode}`).emit("hud_state_updated" as any, { state: newState });
      ack({ ok: true });
    } catch (error) {
      ack({ ok: false, message: error instanceof Error ? error.message : "Unknown error" });
    }
  });

  socket.on("hud_leave_room" as any, (payload: { roomCode: string }, ack: any) => {
    socket.leave(`hud:${payload.roomCode}`);
    ack({ ok: true });
  });
};
