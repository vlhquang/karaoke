import type { Namespace, Socket } from "socket.io";
import type { RoomService } from "../services/room.service";
import { registerRoomHandlers } from "./room.handler";
import { registerGameHandlers, processGameStep } from "./game.handler";

interface AuthedSocket extends Socket {
  data: Socket["data"] & {
    lixi?: { roomId: string; playerId: string; isHost: boolean };
  };
}

export const registerLiXiNamespace = (namespace: Namespace, roomService: RoomService): void => {
  namespace.on("connection", (socket: AuthedSocket) => {
    registerRoomHandlers(socket, roomService);
    registerGameHandlers(socket, roomService);

    socket.on("disconnect", () => {
      roomService.markDisconnected(socket.id);
    });
  });

  // Global Game Ticker: process each active room every second
  setInterval(() => {
    const activeRooms = roomService.getActiveRooms();
    for (const room of activeRooms) {
      try {
        processGameStep(namespace, roomService, room);
      } catch (error) {
        // Silently log or ignore ticker errors to prevent crashing the whole service
        console.error("Ticker error for room", room.roomId, error);
      }
    }
  }, 1000);
};
