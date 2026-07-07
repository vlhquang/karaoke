import { createServer } from "node:http";
import { Server } from "socket.io";
import { createLiXiExpressApp } from "./app";
import { RoomService } from "./services/room.service";
import { registerLiXiNamespace } from "./socket";
import { logger } from "./utils/logger";

const roomService = new RoomService();
const app = createLiXiExpressApp(roomService);
const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: true, methods: ["GET", "POST"] } });

registerLiXiNamespace(io.of("/lixi"), roomService);
setInterval(() => roomService.cleanupExpiredRooms(Date.now()), 5 * 60 * 1000);

const port = Number(process.env.LIXI_PORT ?? 4100);
httpServer.listen(port, "0.0.0.0", () => {
  logger.info("li_xi_server_started", { port, namespace: "/lixi" });
});
