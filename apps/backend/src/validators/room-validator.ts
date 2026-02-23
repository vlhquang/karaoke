import { z } from "zod";

const safeText = z
  .string()
  .trim()
  .min(1)
  .max(80)
  .regex(/^[\p{L}\p{N}\s'._-]+$/u, "Contains invalid characters");

const roomCode = z
  .string()
  .trim()
  .toUpperCase()
  .length(6)
  .regex(/^[A-Z0-9]{6}$/);

export const createRoomSchema = z.object({
  displayName: safeText
});

export const joinRoomSchema = z.object({
  roomCode,
  displayName: safeText
});

export const addSongSchema = z.object({
  roomCode,
  videoId: z.string().trim().regex(/^[a-zA-Z0-9_-]{11}$/),
  title: z.string().trim().min(1).max(200),
  thumbnailUrl: z.string().url(),
  duration: z.string().trim().max(20)
});

export const removeSongSchema = z.object({
  roomCode,
  songId: z.string().uuid()
});

export const skipSongSchema = z.object({
  roomCode,
  reason: z.enum(["manual", "ended"]).optional().default("manual")
});

export const searchSchema = z.object({
  q: z.string().trim().min(2).max(100)
});
