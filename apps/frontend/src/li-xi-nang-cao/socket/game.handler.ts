import type { Socket } from "socket.io";
import type { RoomService } from "../services/room.service";
import { AppError } from "../utils/errors";
import { gameEngines } from "../games";

interface AuthedSocket extends Socket {
  data: Socket["data"] & {
    lixi?: { roomId: string; playerId: string; isHost: boolean };
  };
}

const emitError = (socket: Socket, error: unknown): void => {
  const message = error instanceof AppError ? error.message : error instanceof Error ? error.message : "Unexpected error";
  socket.emit("error", { message });
};

const handleGameAction = (
  socket: AuthedSocket,
  roomService: RoomService,
  eventName: string,
  payload: Record<string, unknown>
): void => {
  try {
    const auth = socket.data.lixi;
    if (!auth) {
      throw new AppError("Unauthorized", 403);
    }

    const room = roomService.getRoom(auth.roomId);
    const player = roomService.getPlayer(room, auth.playerId);
    roomService.ensureGameActive(room);
    roomService.validateAction(room, player, Date.now());

    const engine = gameEngines[room.currentGame!];
    const nextState = engine.handleAction(room, { ...payload, playerId: auth.playerId, _event: eventName }, Date.now());
    socket.nsp.to(`lixi:${auth.roomId}`).emit("game:update", {
      roomId: auth.roomId,
      game: room.currentGame,
      gameState: nextState
    });

    const result = engine.calculateResult(room);

    if (room.currentGame === "memory") {
      socket.nsp.to(`lixi:${auth.roomId}`).emit("game:result", {
        roomId: auth.roomId,
        game: room.currentGame,
        result
      });
      const done = Boolean((result as { done?: boolean }).done);
      if (done) {
        roomService.endGame(room);
        roomService.resetToWaiting(room);
      }
      return;
    }

    const winnerId = (result as { winnerId?: string | null }).winnerId ?? null;
    if (winnerId) {
      roomService.endGame(room);
      socket.nsp.to(`lixi:${auth.roomId}`).emit("game:result", {
        roomId: auth.roomId,
        game: room.currentGame,
        result
      });
      roomService.resetToWaiting(room);
    }
  } catch (error) {
    emitError(socket, error);
  }
};

export const registerGameHandlers = (socket: AuthedSocket, roomService: RoomService): void => {
  socket.on("reaction:tap", (payload: Record<string, unknown>) => handleGameAction(socket, roomService, "reaction:tap", payload));
  socket.on("memory:flip", (payload: Record<string, unknown>) => handleGameAction(socket, roomService, "memory:flip", payload));
  socket.on("memory:ready", (payload: Record<string, unknown>) => handleGameAction(socket, roomService, "memory:ready", payload));
  socket.on("memory:complete", (payload: Record<string, unknown>) => handleGameAction(socket, roomService, "memory:complete", payload));
  socket.on("rps:submit", (payload: Record<string, unknown>) => handleGameAction(socket, roomService, "rps:submit", payload));
  socket.on("number:tap", (payload: Record<string, unknown>) => handleGameAction(socket, roomService, "number:tap", payload));
  socket.on("shake:submit", (payload: Record<string, unknown>) => handleGameAction(socket, roomService, "shake:submit", payload));
  socket.on("color:tap", (payload: Record<string, unknown>) => handleGameAction(socket, roomService, "color:tap", payload));
};
