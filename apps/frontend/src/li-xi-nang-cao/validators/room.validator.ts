import { z } from "zod";

export const createRoomSchema = z.object({
  name: z.string().trim().min(1).max(80),
  victoryImageDataUrl: z.string().max(6_000_000).optional()
});

export const joinRoomSchema = z.object({
  roomId: z.string().trim().min(4).max(12),
  name: z.string().trim().min(1).max(80),
  victoryImageDataUrl: z.string().max(6_000_000).optional()
});

export const startGameSchema = z.object({
  roomId: z.string().trim().min(4).max(12),
  options: z.object({
    memory: z.object({
      boardLength: z.number().int().min(4).max(64).refine((value) => value % 2 === 0, "boardLength must be even"),
      theme: z.enum(["sports", "animals", "fruits", "vehicles"]).optional()
    }).optional(),
    rps: z.object({
      mode: z.enum(["BO1", "BO3", "BO5", "BO7", "BO11"]).optional()
    }).optional(),
    number: z.object({
      targetCount: z.number().int().min(1).max(100).optional(),
      itemLifetimeMs: z.number().int().min(500).max(10000).optional(),
      winCondition: z.enum(["unique", "ranking"]).optional()
    }).optional(),
    shake: z.object({}).optional(),
    color: z.object({}).optional(),
    mathking: z.object({
      grade: z.enum(["1", "2", "3", "4", "5"]).optional(),
      targetScore: z.union([z.literal(5), z.literal(10), z.literal(15), z.literal(20)]).optional(),
      answerTimeSec: z.number().int().min(5).max(60).optional()
    }).optional()
  }).optional()
});

export const selectGameSchema = z.object({
  roomId: z.string().trim().min(4).max(12),
  gameType: z.enum(["reaction", "memory", "rps", "number", "shake", "color", "mathking"]),
  options: z.object({
    memory: z.object({
      boardLength: z.number().int().min(4).max(64).refine((value) => value % 2 === 0, "boardLength must be even"),
      theme: z.enum(["sports", "animals", "fruits", "vehicles"]).optional()
    }).optional(),
    rps: z.object({
      mode: z.enum(["BO1", "BO3", "BO5", "BO7", "BO11"]).optional()
    }).optional(),
    number: z.object({
      targetCount: z.number().int().min(1).max(100).optional(),
      itemLifetimeMs: z.number().int().min(500).max(10000).optional(),
      winCondition: z.enum(["unique", "ranking"]).optional()
    }).optional(),
    shake: z.object({}).optional(),
    color: z.object({}).optional(),
    mathking: z.object({
      grade: z.enum(["1", "2", "3", "4", "5"]).optional(),
      targetScore: z.union([z.literal(5), z.literal(10), z.literal(15), z.literal(20)]).optional(),
      answerTimeSec: z.number().int().min(5).max(60).optional()
    }).optional()
  }).optional()
});

export const roomIdSchema = z.object({
  roomId: z.string().trim().min(4).max(12)
});

export const setReadySchema = z.object({
  roomId: z.string().trim().min(4).max(12),
  ready: z.boolean()
});

export const kickPlayerSchema = z.object({
  roomId: z.string().trim().min(4).max(12),
  playerId: z.string().uuid()
});
