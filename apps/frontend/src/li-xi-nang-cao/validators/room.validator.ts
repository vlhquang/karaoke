import { z } from "zod";

export const createRoomSchema = z.object({
  name: z.string().trim().min(1).max(80)
});

export const joinRoomSchema = z.object({
  roomId: z.string().trim().min(4).max(12),
  name: z.string().trim().min(1).max(80)
});

export const startGameSchema = z.object({
  roomId: z.string().trim().min(4).max(12),
  gameType: z.enum(["reaction", "memory", "rps", "number", "shake", "color"]),
  options: z.object({
    memory: z.object({
      boardLength: z.number().int().min(4).max(64).refine((value) => value % 2 === 0, "boardLength must be even")
    }).optional()
  }).optional()
});

export const roomIdSchema = z.object({
  roomId: z.string().trim().min(4).max(12)
});
