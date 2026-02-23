import { createServer } from "http";
import { Server } from "socket.io";
import type { ClientToServerEvents, ServerToClientEvents } from "@karaoke/shared";
import { createApp } from "./app.js";
import { env } from "./config/env.js";
import { logger } from "./config/logger.js";
import { RoomService } from "./services/room-service.js";
import { QueueService } from "./services/queue/queue-service.js";
import { registerHandlers } from "./sockets/register-handlers.js";
import { SocketRateLimiter } from "./services/socket-rate-limiter.js";

const bootstrap = async (): Promise<void> => {
  const app = createApp();
  const server = createServer(app);

  const io = new Server<ClientToServerEvents, ServerToClientEvents>(server, {
    cors: {
      origin: env.BACKEND_CORS_ORIGIN,
      methods: ["GET", "POST"]
    },
    transports: ["websocket", "polling"]
  });

  const roomService = new RoomService();
  const queueService = new QueueService();
  const socketRateLimiter = new SocketRateLimiter();

  io.on("connection", (socket) => {
    registerHandlers(io, socket, roomService, queueService, socketRateLimiter);
  });

  server.listen(env.BACKEND_PORT, () => {
    logger.info({ port: env.BACKEND_PORT }, "Backend listening");
  });

  const gracefulShutdown = async (): Promise<void> => {
    logger.info("Shutting down gracefully...");
    io.close();
    server.close();
    process.exit(0);
  };

  process.on("SIGINT", gracefulShutdown);
  process.on("SIGTERM", gracefulShutdown);
};

bootstrap().catch((error) => {
  logger.error({ error }, "Failed to bootstrap server");
  process.exit(1);
});
