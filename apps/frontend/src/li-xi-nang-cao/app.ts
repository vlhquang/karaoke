import express, { type Express } from "express";
import cors from "cors";
import { requestLogger } from "./middlewares/request-logger";
import { errorHandler } from "./middlewares/error-handler";
import { createRoomRoutes } from "./routes/room.routes";
import type { RoomService } from "./services/room.service";

export const createLiXiExpressApp = (roomService: RoomService): Express => {
  const app = express();
  app.use(cors());
  app.use(express.json({ limit: "1mb" }));
  app.use(requestLogger);
  app.use("/api/li-xi-nang-cao", createRoomRoutes(roomService));
  app.use(errorHandler);
  return app;
};
