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

  // Bot simulation logic
  const botId = "bot-player-id";
  const botMatch = room.players.get(botId);
  if (botMatch && botMatch.isOnline) {
    const engine = (gameEngines as any)[room.currentGame];
    if (engine) {
      const now = Date.now();
      if (room.currentGame === "reaction") {
        const state = room.gameState as any;
        if (state.signalTime > 0 && now >= state.signalTime && (!state.taps[botId] || state.taps[botId].tappedAt === 0)) {
          // Bot taps after signal with random delay
          const delay = Math.floor(Math.random() * 400) + 200;
          setTimeout(() => {
            try {
              const latestRoom = roomService.getRoom(room.roomId);
              if (latestRoom.status === "playing" && latestRoom.currentGame === "reaction") {
                engine.handleAction(latestRoom, { playerId: botId }, Date.now());
                nsp.to(`lixi:${room.roomId}`).emit("game:update", {
                  roomId: room.roomId,
                  game: "reaction",
                  gameState: latestRoom.gameState
                });
                processGameStep(nsp, roomService, latestRoom);
              }
            } catch (e) { /* ignore */ }
          }, delay);
        }
      }
      // RPS: engine.calculateResult handles missing choices anyway, so no need for explicit bot submit
      // except to make it look active. Let's add RPS bot choice injection for better feedback.
      if (room.currentGame === "rps") {
        const state = room.gameState as any;
        const currentRound = state.rounds[state.currentRoundIndex];
        if (!currentRound.revealed && !currentRound.submissions[botId]) {
          // Bot submits choice randomly
          const choices = ["rock", "paper", "scissors"];
          currentRound.submissions[botId] = choices[Math.floor(Math.random() * choices.length)];
          // Calculate result will see this
        }
      }
    }
  }

  const engine = (gameEngines as any)[room.currentGame];
  if (!engine) return;

  const result = engine.calculateResult(room);

  if (room.currentGame === "memory") {
    nsp.to(`lixi:${room.roomId}`).emit("game:result", {
      roomId: room.roomId,
      game: room.currentGame,
      result,
      winner: (result as { winnerId?: string | null }).winnerId ? roomService.getWinnerAnnouncement(room, (result as { winnerId?: string | null }).winnerId!) : null
    });
  }

  const winnerId = (result as { winnerId?: string | null }).winnerId ?? null;
  const isDone = Boolean((result as { done?: boolean }).done);

  if (room.currentGame === "rps" || room.currentGame === "number" || room.currentGame === "reaction" || room.currentGame === "racing") {
    nsp.to(`lixi:${room.roomId}`).emit("game:update", {
      roomId: room.roomId,
      game: room.currentGame,
      gameState: result
    });
  }

  if (isDone) {
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
  socket.on("number:found", (payload: Record<string, unknown>) => handleGameAction(socket, roomService, "number:found", payload));
  socket.on("shake:submit", (payload: Record<string, unknown>) => handleGameAction(socket, roomService, "shake:submit", payload));
  socket.on("color:tap", (payload: Record<string, unknown>) => handleGameAction(socket, roomService, "color:tap", payload));
  socket.on("racing:tap", (payload: Record<string, unknown>) => handleGameAction(socket, roomService, "racing:tap", payload));
};
