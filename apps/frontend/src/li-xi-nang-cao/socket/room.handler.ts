import type { Socket } from "socket.io";
import type { RoomService } from "../services/room.service";
import { createRoomSchema, joinRoomSchema, roomIdSchema, startGameSchema, selectGameSchema, setReadySchema, kickPlayerSchema } from "../validators/room.validator";
import { gameEngines } from "../games";
import { processGameStep } from "./game.handler";
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
  selectedGame: room.selectedGame,
  countdownEndsAt: room.countdownEndsAt,
  currentGame: room.currentGame,
  players: [...room.players.values()].map((p) => ({
    playerId: p.playerId,
    name: p.name,
    score: p.score,
    latency: p.latency,
    isOnline: p.isOnline,
    ready: p.ready
  }))
});

const countdownTimers = new Map<string, ReturnType<typeof setTimeout>>();
const gameTickers = new Map<string, ReturnType<typeof setInterval>>();

const startGameTicker = (nsp: any, roomService: RoomService, roomId: string) => {
  stopGameTicker(roomId);
  const ticker = setInterval(() => {
    try {
      const room = roomService.getRoom(roomId);
      if (room.status !== "playing") {
        stopGameTicker(roomId);
        return;
      }
      processGameStep(nsp, roomService, room);
    } catch (e) {
      stopGameTicker(roomId);
    }
  }, 1000);
  gameTickers.set(roomId, ticker);
};

const stopGameTicker = (roomId: string) => {
  const existing = gameTickers.get(roomId);
  if (existing) {
    clearInterval(existing);
    gameTickers.delete(roomId);
  }
};

const emitError = (socket: Socket, error: unknown): void => {
  const message = error instanceof AppError ? error.message : error instanceof Error ? error.message : "Unexpected error";
  socket.emit("error", { message });
};

const clearCountdownTimer = (roomId: string): void => {
  const existing = countdownTimers.get(roomId);
  if (existing) {
    clearTimeout(existing);
    countdownTimers.delete(roomId);
  }
};

export const registerRoomHandlers = (socket: AuthedSocket, roomService: RoomService): void => {
  socket.on("host:createRoom", (payload: unknown, ack?: (res: unknown) => void) => {
    try {
      const parsed = createRoomSchema.parse(payload);
      const { room, hostPlayer } = roomService.createRoom(parsed.name, socket.id, parsed.victoryImageDataUrl);
      socket.data.lixi = { roomId: room.roomId, playerId: hostPlayer.playerId, isHost: true };
      socket.join(`lixi:${room.roomId}`);
      socket.emit("room:created", { room: toRoomPayload(room), playerId: hostPlayer.playerId });
      if (ack) ack({ ok: true, roomId: room.roomId, playerId: hostPlayer.playerId });
    } catch (error) {
      emitError(socket, error);
      if (ack) {
        const message = error instanceof AppError ? error.message : error instanceof Error ? error.message : "Create room failed";
        ack({ ok: false, message });
      }
    }
  });

  socket.on("room:restoreSession", (payload: any, ack?: (res: any) => void) => {
    try {
      const { roomId, playerId } = payload;
      const { room, player } = roomService.restorePlayer(roomId, playerId, socket.id);

      socket.data.lixi = { roomId: room.roomId, playerId: player.playerId, isHost: room.hostId === player.playerId };
      socket.join(`lixi:${room.roomId}`);

      // Notify others that player is back online
      socket.to(`lixi:${room.roomId}`).emit("game:update", { room: toRoomPayload(room) });

      if (ack) ack({ ok: true, room: toRoomPayload(room), playerId: player.playerId });
    } catch (error) {
      if (ack) ack({ ok: false, message: error instanceof Error ? error.message : "Restore session failed" });
    }
  });

  socket.on("player:joinRoom", (payload: unknown, ack?: (res: unknown) => void) => {
    try {
      const parsed = joinRoomSchema.parse(payload);
      const { room, player } = roomService.joinRoom(parsed.roomId, parsed.name, socket.id, parsed.victoryImageDataUrl);
      socket.data.lixi = { roomId: room.roomId, playerId: player.playerId, isHost: false };
      socket.join(`lixi:${room.roomId}`);
      socket.emit("room:joined", { room: toRoomPayload(room), playerId: player.playerId });
      socket.to(`lixi:${room.roomId}`).emit("game:update", { room: toRoomPayload(room) });
      if (ack) ack({ ok: true, roomId: room.roomId, playerId: player.playerId });
    } catch (error) {
      emitError(socket, error);
      if (ack) {
        const message = error instanceof AppError ? error.message : error instanceof Error ? error.message : "Join room failed";
        ack({ ok: false, message });
      }
    }
  });

  socket.on("host:selectGame", (payload: unknown, ack?: (res: unknown) => void) => {
    try {
      const parsed = selectGameSchema.parse(payload);
      const auth = socket.data.lixi;
      if (!auth || auth.roomId !== parsed.roomId) {
        throw new AppError("Unauthorized", 403);
      }
      const room = roomService.getRoom(parsed.roomId);
      roomService.ensureHost(room, auth.playerId);
      if (room.status !== "waiting") {
        throw new AppError("Only waiting room can select game", 400);
      }
      const hostPlayer = roomService.getPlayer(room, auth.playerId);
      if (hostPlayer.ready) {
        throw new AppError("Host must unready before changing game", 400);
      }
      roomService.setSelectedGame(room, parsed.gameType as GameType, parsed.options);
      socket.nsp.to(`lixi:${parsed.roomId}`).emit("game:update", { room: toRoomPayload(room) });
      if (ack) ack({ ok: true });
    } catch (error) {
      emitError(socket, error);
      if (ack) ack({ ok: false });
    }
  });

  socket.on("player:setReady", (payload: unknown, ack?: (res: unknown) => void) => {
    try {
      const parsed = setReadySchema.parse(payload);
      const auth = socket.data.lixi;
      if (!auth || auth.roomId !== parsed.roomId) {
        throw new AppError("Unauthorized", 403);
      }
      const room = roomService.getRoom(parsed.roomId);
      if (room.status !== "waiting") {
        throw new AppError("Cannot change ready status right now", 400);
      }
      roomService.setPlayerReady(room, auth.playerId, parsed.ready);
      socket.nsp.to(`lixi:${parsed.roomId}`).emit("game:update", { room: toRoomPayload(room) });
      if (ack) ack({ ok: true });
    } catch (error) {
      emitError(socket, error);
      if (ack) ack({ ok: false });
    }
  });

  socket.on("host:kickPlayer", (payload: unknown, ack?: (res: unknown) => void) => {
    try {
      const parsed = kickPlayerSchema.parse(payload);
      const auth = socket.data.lixi;
      if (!auth || auth.roomId !== parsed.roomId) {
        throw new AppError("Unauthorized", 403);
      }
      const room = roomService.getRoom(parsed.roomId);
      roomService.ensureHost(room, auth.playerId);
      if (room.status !== "waiting") {
        throw new AppError("Cannot kick during active game", 400);
      }
      const target = roomService.getPlayer(room, parsed.playerId);
      if (target.ready) {
        throw new AppError("Only unready players can be kicked", 400);
      }
      roomService.removePlayer(room, parsed.playerId);
      socket.nsp.to(`lixi:${parsed.roomId}`).emit("game:update", { room: toRoomPayload(room) });
      socket.nsp.to(target.socketId).emit("error", { message: "Bạn đã bị host mời ra khỏi phòng." });
      if (ack) ack({ ok: true });
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
      if (room.status !== "waiting") {
        throw new AppError("Room is not in waiting status", 400);
      }
      if (!room.selectedGame) {
        throw new AppError("Host has not selected a game", 400);
      }
      if (parsed.options) {
        room.selectedGameOptions = {
          ...(room.selectedGameOptions ?? {}),
          ...parsed.options,
          memory: parsed.options.memory ? {
            ...(room.selectedGameOptions?.memory ?? {}),
            ...parsed.options.memory
          } : room.selectedGameOptions?.memory,
          rps: parsed.options.rps ? {
            ...(room.selectedGameOptions?.rps ?? {}),
            ...parsed.options.rps
          } : room.selectedGameOptions?.rps,
          number: parsed.options.number ? {
            ...(room.selectedGameOptions?.number ?? {}),
            ...parsed.options.number
          } : room.selectedGameOptions?.number,
          racing: parsed.options.racing ? {
            ...(room.selectedGameOptions?.racing ?? {}),
            ...parsed.options.racing
          } : room.selectedGameOptions?.racing
        };
      }
      if (!roomService.areAllOnlinePlayersReady(room)) {
        throw new AppError("All online players must be ready", 400);
      }

      clearCountdownTimer(parsed.roomId);
      room.status = "countdown";
      room.countdownEndsAt = Date.now() + 5000;
      socket.nsp.to(`lixi:${parsed.roomId}`).emit("game:update", { room: toRoomPayload(room) });

      const timeout = setTimeout(() => {
        try {
          const latestRoom = roomService.getRoom(parsed.roomId);
          if (latestRoom.status !== "countdown" || !latestRoom.selectedGame) {
            return;
          }
          const selectedGame = latestRoom.selectedGame;
          const engine = gameEngines[selectedGame];
          const initialState = engine.initGame(latestRoom, latestRoom.selectedGameOptions ?? undefined);
          roomService.startGame(latestRoom, selectedGame, initialState);
          socket.nsp.to(`lixi:${parsed.roomId}`).emit("game:started", {
            room: toRoomPayload(latestRoom),
            gameState: latestRoom.gameState
          });
          // Trigger bot simulation if solo
          processGameStep(socket.nsp, roomService, latestRoom);
          // Start periodic ticker for this room
          startGameTicker(socket.nsp, roomService, parsed.roomId);
        } finally {
          clearCountdownTimer(parsed.roomId);
        }
      }, 5000);
      countdownTimers.set(parsed.roomId, timeout);
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
      clearCountdownTimer(parsed.roomId);
      stopGameTicker(parsed.roomId);

      roomService.endGame(room);
      socket.nsp.to(`lixi:${parsed.roomId}`).emit("game:result", {
        room: toRoomPayload(room),
        result: room.gameState
      });
      roomService.resetToWaiting(room, true);
      socket.nsp.to(`lixi:${parsed.roomId}`).emit("game:update", {
        room: toRoomPayload(room),
        gameState: null
      });
      if (ack) ack({ ok: true });
    } catch (error) {
      emitError(socket, error);
      if (ack) ack({ ok: false });
    }
  });

  socket.on("host:restartGame", (payload: unknown, ack?: (res: unknown) => void) => {
    try {
      const parsed = roomIdSchema.parse(payload);
      const auth = socket.data.lixi;
      if (!auth || auth.roomId !== parsed.roomId) {
        throw new AppError("Unauthorized", 403);
      }
      const room = roomService.getRoom(parsed.roomId);
      roomService.ensureHost(room, auth.playerId);

      if (room.status !== "finished" && room.status !== "playing") {
        throw new AppError("Game cannot be restarted from current state", 400);
      }

      const gameType = room.currentGame || room.selectedGame;
      if (!gameType) {
        throw new AppError("No game to restart", 400);
      }

      const engine = gameEngines[gameType];
      const initialState = engine.initGame(room, room.selectedGameOptions ?? undefined);
      roomService.startGame(room, gameType, initialState);

      socket.nsp.to(`lixi:${parsed.roomId}`).emit("game:update", {
        room: toRoomPayload(room),
        gameState: room.gameState
      });

      // Trigger bot simulation if solo
      processGameStep(socket.nsp, roomService, room);
      // Start periodic ticker for this room
      startGameTicker(socket.nsp, roomService, parsed.roomId);

      if (ack) ack({ ok: true });
    } catch (error) {
      emitError(socket, error);
      if (ack) ack({ ok: false, message: error instanceof Error ? error.message : "Restart failed" });
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
