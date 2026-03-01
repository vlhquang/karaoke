import { Router } from "express";
import type { RoomService } from "../services/room.service";

export const createRoomRoutes = (roomService: RoomService): Router => {
  const router = Router();

  router.get("/health", (_req, res) => {
    res.json({ ok: true, service: "li-xi-nang-cao", now: Date.now() });
  });

  router.get("/rooms", (_req, res) => {
    res.json({ ok: true, rooms: roomService.listRooms() });
  });

  return router;
};
