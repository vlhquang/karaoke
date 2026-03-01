import type { Socket } from "socket.io";
import type { RoomService } from "../services/room.service";
import { createRoomSchema, joinRoomSchema, roomIdSchema, startGameSchema } from "../validators/room.validator";
import { gameEngines } from "../games";
import type { GameType } from "../types";
import { AppError } from "../utils/errors";
import { logger } from "../utils/logger";
import { z } from "zod";

interface AuthedSocket extends Socket {
  data: Socket["data"] & {
    lixi?: { roomId: string; playerId: string; isHost: boolean };
  };
}

const latencySchema = z.object({
  roomId: z.string().trim().min(4).max(12),
  playerId: z.string().uuid(),
  pingId: z.string().regex(/^\d+$/)
});

const toRoomPayload = (room: ReturnType<RoomService["getRoom"]>): Record<string, unknown> => ({
  roomId: room.roomId,
  hostId: room.hostId,
  status: room.status,
  currentGame: room.currentGame,
  players: [...room.players.values()].map((p) => ({
    playerId: p.playerId,
    name: p.name,
    score: p.score,
    latency: p.latency,
    isOnline: p.isOnline
  }))
});

const emitError = (socket: Socket, error: unknown): void => {
  const message = error instanceof AppError ? error.message : error instanceof Error ? error.message : "Unexpected error";
  socket.emit("error", { message });
};

export const registerRoomHandlers = (socket: AuthedSocket, roomService: RoomService): void => {
  socket.on("host:createRoom", (payload: unknown, ack?: (res: unknown) => void) => {
    try {
      const parsed = createRoomSchema.parse(payload);
      const { room, hostPlayer } = roomService.createRoom(parsed.name, socket.id);
      socket.data.lixi = { roomId: room.roomId, playerId: hostPlayer.playerId, isHost: true };
      socket.join(`lixi:${room.roomId}`);
      socket.emit("room:created", { room: toRoomPayload(room), playerId: hostPlayer.playerId });
      if (ack) ack({ ok: true, roomId: room.roomId, playerId: hostPlayer.playerId });
    } catch (error) {
      emitError(socket, error);
      if (ack) ack({ ok: false });
    }
  });

  socket.on("player:joinRoom", (payload: unknown, ack?: (res: unknown) => void) => {
    try {
      const parsed = joinRoomSchema.parse(payload);
      const { room, player } = roomService.joinRoom(parsed.roomId, parsed.name, socket.id);
      socket.data.lixi = { roomId: room.roomId, playerId: player.playerId, isHost: false };
      socket.join(`lixi:${room.roomId}`);
      socket.emit("room:joined", { room: toRoomPayload(room), playerId: player.playerId });
      socket.to(`lixi:${room.roomId}`).emit("game:update", { room: toRoomPayload(room) });
      if (ack) ack({ ok: true, roomId: room.roomId, playerId: player.playerId });
    } catch (error) {
      emitError(socket, error);
      if (ack) ack({ ok: false });
    }
  });

  socket.on("host:startGame", (payload: unknown, ack?: (res: unknown) => void) => {
    try {
      const parsed = startGameSchema.parse(payload);
      const auth = socket.data.lixi;
      if (!auth || auth.roomId !== parsed.roomId) {
        throw new AppError("Unauthorized", 403);
      }
      const room = roomService.getRoom(parsed.roomId);
      roomService.ensureHost(room, auth.playerId);

      const engine = gameEngines[parsed.gameType as GameType];
      const initialState = engine.initGame(room, parsed.options);
      roomService.startGame(room, parsed.gameType as GameType, initialState);

      socket.nsp.to(`lixi:${parsed.roomId}`).emit("game:started", {
        room: toRoomPayload(room),
        gameState: room.gameState
      });
      if (ack) ack({ ok: true });
    } catch (error) {
      emitError(socket, error);
      if (ack) ack({ ok: false });
    }
  });

  socket.on("host:endGame", (payload: unknown, ack?: (res: unknown) => void) => {
    try {
      const parsed = roomIdSchema.parse(payload);
      const auth = socket.data.lixi;
      if (!auth || auth.roomId !== parsed.roomId) {
        throw new AppError("Unauthorized", 403);
      }
      const room = roomService.getRoom(parsed.roomId);
      roomService.ensureHost(room, auth.playerId);

      roomService.endGame(room);
      socket.nsp.to(`lixi:${parsed.roomId}`).emit("game:result", {
        room: toRoomPayload(room),
        result: room.gameState
      });
      roomService.resetToWaiting(room);
      if (ack) ack({ ok: true });
    } catch (error) {
      emitError(socket, error);
      if (ack) ack({ ok: false });
    }
  });

  socket.on("latency:pong", (payload: unknown) => {
    try {
      const parsed = latencySchema.parse(payload);
      const now = Date.now();
      const pingAt = Number(parsed.pingId);
      const latency = Math.max(0, now - pingAt);
      roomService.setLatency(parsed.roomId, parsed.playerId, latency);
    } catch (error) {
      logger.warn("latency_pong_invalid", { socketId: socket.id, reason: error instanceof Error ? error.message : "invalid" });
    }
  });
};
