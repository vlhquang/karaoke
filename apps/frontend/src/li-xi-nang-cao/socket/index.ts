import type { Namespace, Socket } from "socket.io";
import type { RoomService } from "../services/room.service";
import { registerRoomHandlers } from "./room.handler";
import { registerGameHandlers } from "./game.handler";

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
};
