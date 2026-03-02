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

export const processGameStep = (
  nsp: any,
  roomService: RoomService,
  room: any
): void => {
  if (!room.currentGame) return;
  const engine = (gameEngines as any)[room.currentGame];
  if (!engine) return;

  const result = engine.calculateResult(room);

  if (room.currentGame === "memory") {
    const winnerId = (result as { winnerId?: string | null }).winnerId ?? null;
    const winner = winnerId ? roomService.getWinnerAnnouncement(room, winnerId) : null;
    nsp.to(`lixi:${room.roomId}`).emit("game:result", {
      roomId: room.roomId,
      game: room.currentGame,
      result,
      winner
    });
    const done = Boolean((result as { done?: boolean }).done);
    if (done) {
      roomService.endGame(room);
    }
    return;
  }

  // Common result emission for RPS and others
  const winnerId = (result as { winnerId?: string | null }).winnerId ?? null;
  const isDone = Boolean((result as { done?: boolean }).done);

  // For RPS, we might want to emit update even if not done, if the state was updated (e.g. revealed)
  if (room.currentGame === "rps") {
    nsp.to(`lixi:${room.roomId}`).emit("game:update", {
      roomId: room.roomId,
      game: room.currentGame,
      gameState: result
    });
  }

  if (winnerId || isDone) {
    const winner = winnerId ? roomService.getWinnerAnnouncement(room, winnerId) : null;
    roomService.endGame(room);
    nsp.to(`lixi:${room.roomId}`).emit("game:result", {
      roomId: room.roomId,
      game: room.currentGame,
      result,
      winner
    });
  }
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

    processGameStep(socket.nsp, roomService, room);
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
